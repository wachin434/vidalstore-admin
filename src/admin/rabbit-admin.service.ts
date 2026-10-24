import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { MensajeriaService } from '../mensajeria/mensajeria.service';
import { EXCHANGE_COMANDOS, RK_DLQ_REPROCESAR } from '../mensajeria/topologia';
import { BindingDto } from './dto/binding.dto';
import { CrearColaDto } from './dto/crear-cola.dto';
import { CrearExchangeDto } from './dto/crear-exchange.dto';

/**
 * Toda la lógica de administración del broker vive en esta clase.
 *
 * Decisión del grupo: las escrituras (crear y eliminar) se hacen por la API HTTP
 * de management (puerto 15672) y no por un canal AMQP, porque así colas,
 * exchanges y bindings se administran con el mismo cliente que ya se necesita
 * para los listados (que por AMQP no existen), y un error de datos vuelve como
 * respuesta HTTP clara y no como un cierre de canal que se llevaría los
 * consumidores. La única publicación AMQP es el comando de reproceso.
 */
@Injectable()
export class RabbitAdminService {
  protected http: AxiosInstance;
  private readonly vhost = '%2F';

  constructor(private readonly mensajeria: MensajeriaService) {
    this.http = axios.create({
      baseURL: process.env.RABBITMQ_MGMT_URL ?? 'http://localhost:15672',
      timeout: 10_000,
      auth: {
        username: process.env.RABBITMQ_MGMT_USER ?? 'guest',
        password: process.env.RABBITMQ_MGMT_PASS ?? 'guest',
      },
    });
  }

  /* ----------------------------- colas ----------------------------- */

  async listarColas() {
    try {
      const { data } = await this.http.get(`/api/queues/${this.vhost}`);
      return data.map((c: any) => ({
        nombre: c.name,
        tipo: c.type,
        durable: c.durable,
        mensajes: c.messages,
        mensajesListos: c.messages_ready,
        mensajesNoConfirmados: c.messages_unacknowledged,
        consumidores: c.consumers,
        estado: c.state,
      }));
    } catch (e) {
      this.traducir(e, 'listar las colas');
    }
  }

  async crearCola(dto: CrearColaDto) {
    const durable = dto.durable ?? true;
    try {
      await this.http.put(`/api/queues/${this.vhost}/${encodeURIComponent(dto.nombre)}`, {
        durable,
        auto_delete: false,
        // Una cola quorum exige ser durable; si no lo es, queda clásica.
        arguments: { 'x-queue-type': durable ? 'quorum' : 'classic' },
      });
      return { nombre: dto.nombre, durable, tipo: durable ? 'quorum' : 'classic' };
    } catch (e) {
      this.traducir(e, `la cola '${dto.nombre}'`);
    }
  }

  async eliminarCola(nombre: string): Promise<void> {
    try {
      await this.http.delete(`/api/queues/${this.vhost}/${encodeURIComponent(nombre)}`);
    } catch (e) {
      this.traducir(e, `la cola '${nombre}'`);
    }
  }

  /* --------------------------- exchanges --------------------------- */

  async listarExchanges() {
    try {
      const { data } = await this.http.get(`/api/exchanges/${this.vhost}`);
      return data
        .filter((e: any) => e.name !== '')
        .map((e: any) => ({ nombre: e.name, tipo: e.type, durable: e.durable }));
    } catch (e) {
      this.traducir(e, 'listar los exchanges');
    }
  }

  async crearExchange(dto: CrearExchangeDto) {
    this.rechazarNombreReservado(dto.nombre);
    const durable = dto.durable ?? true;
    try {
      await this.http.put(`/api/exchanges/${this.vhost}/${encodeURIComponent(dto.nombre)}`, {
        type: dto.tipo,
        durable,
        auto_delete: false,
        internal: false,
      });
      return { nombre: dto.nombre, tipo: dto.tipo, durable };
    } catch (e) {
      this.traducir(e, `el exchange '${dto.nombre}'`);
    }
  }

  async eliminarExchange(nombre: string): Promise<void> {
    this.rechazarNombreReservado(nombre);
    try {
      await this.http.delete(`/api/exchanges/${this.vhost}/${encodeURIComponent(nombre)}`);
    } catch (e) {
      this.traducir(e, `el exchange '${nombre}'`);
    }
  }

  /* ---------------------------- bindings --------------------------- */

  async crearBinding(dto: BindingDto) {
    try {
      await this.http.post(
        `/api/bindings/${this.vhost}/e/${encodeURIComponent(dto.exchange)}/q/${encodeURIComponent(dto.cola)}`,
        { routing_key: dto.routingKey },
      );
      return { exchange: dto.exchange, cola: dto.cola, routingKey: dto.routingKey };
    } catch (e) {
      this.traducir(e, `el exchange '${dto.exchange}' o la cola '${dto.cola}'`);
    }
  }

  /**
   * Para borrar un binding la API pide su properties_key, que no es la routing
   * key: hay que buscarlo entre los bindings del par exchange-cola. Ya viene
   * codificado para URL, por eso se usa tal cual.
   */
  async eliminarBinding(dto: BindingDto): Promise<void> {
    const ruta = `/api/bindings/${this.vhost}/e/${encodeURIComponent(dto.exchange)}/q/${encodeURIComponent(dto.cola)}`;
    try {
      const { data } = await this.http.get(ruta);
      const binding = (data as any[]).find((b) => b.routing_key === dto.routingKey);
      if (!binding) {
        throw new NotFoundException(
          `no existe un binding de '${dto.exchange}' a '${dto.cola}' con la routing key '${dto.routingKey}'`,
        );
      }
      await this.http.delete(`${ruta}/${binding.properties_key}`);
    } catch (e) {
      this.traducir(e, `el exchange '${dto.exchange}' o la cola '${dto.cola}'`);
    }
  }

  /* ------------------------ reproceso de DLQ ------------------------ */

  /**
   * Solo grupos de 3. Publica el comando dlq.reprocesar; este servicio no toca
   * la tabla mensajes_muertos (es de vidalstore-eventos), solo pide el reproceso.
   */
  async solicitarReproceso(
    mensajeMuertoId: string,
    payloadCorregido: Record<string, unknown> | undefined,
    solicitadoPor: string,
  ) {
    const payload: Record<string, unknown> = { mensajeMuertoId, solicitadoPor };
    if (payloadCorregido !== undefined) payload.payloadCorregido = payloadCorregido;

    try {
      const eventoId = await this.mensajeria.publicar(EXCHANGE_COMANDOS, RK_DLQ_REPROCESAR, payload);
      return { mensajeMuertoId, solicitadoPor, eventoId, estado: 'solicitado' };
    } catch (e) {
      throw new ServiceUnavailableException(
        `no se pudo publicar el comando de reproceso: ${(e as Error).message}`,
      );
    }
  }

  /* ------------------------- apoyo interno ------------------------- */

  private rechazarNombreReservado(nombre: string): void {
    if (nombre.startsWith('amq.')) {
      throw new BadRequestException(
        "nombre no puede empezar con 'amq.': ese prefijo está reservado por el broker",
      );
    }
  }

  /** Traduce los errores de la API de management a respuestas HTTP con sentido. */
  private traducir(error: unknown, contexto: string): never {
    if (error instanceof HttpException) throw error;

    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new ServiceUnavailableException(
          'no se pudo conectar con la API de management de RabbitMQ',
        );
      }
      const { status, data } = error.response;
      const razon: string = data?.reason ?? data?.error ?? 'error sin detalle';

      if (status === 404) {
        throw new NotFoundException(`no existe ${contexto}`);
      }
      if (status === 400 || status === 406) {
        if (/PRECONDITION_FAILED|inequivalent/i.test(razon)) {
          throw new ConflictException(`${contexto} ya existe con otra configuración: ${razon}`);
        }
        throw new BadRequestException(`el broker rechazó la petición sobre ${contexto}: ${razon}`);
      }
      if (status === 401 || status === 403) {
        throw new BadGatewayException('el broker rechazó las credenciales de management');
      }
      throw new BadGatewayException(`el broker respondió ${status}: ${razon}`);
    }

    throw new BadGatewayException(`error inesperado al hablar con el broker: ${(error as Error).message}`);
  }
}
