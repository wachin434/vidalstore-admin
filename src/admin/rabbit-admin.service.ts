import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { COLAS, EXCHANGE_COMANDOS, EXCHANGE_DLX, EXCHANGE_EVENTOS } from '../../mensajeria/topologia';
import { AplicarPoliticaDto } from './dto/aplicar-politica.dto';

@Injectable()
export class RabbitAdminService {
  private readonly http: AxiosInstance;
  private readonly vhost = '%2f';

  constructor() {
    this.http = axios.create({
      baseURL: process.env.RABBITMQ_MGMT_URL ?? 'http://localhost:15672',
      auth: {
        username: process.env.RABBITMQ_MGMT_USER ?? 'guest',
        password: process.env.RABBITMQ_MGMT_PASS ?? 'guest',
      },
    });
  }

  async listarColas() {
    const { data } = await this.http.get(`/api/queues/${this.vhost}`);
    return data.map((c: any) => ({
      nombre: c.name,
      tipo: c.type,
      mensajes: c.messages,
      mensajesListos: c.messages_ready,
      mensajesNoConfirmados: c.messages_unacknowledged,
      consumidores: c.consumers,
      estado: c.state,
    }));
  }

  async detalleCola(nombre: string) {
    const { data } = await this.http.get(
      `/api/queues/${this.vhost}/${encodeURIComponent(nombre)}`,
    );
    return {
      nombre: data.name,
      tipo: data.type,
      mensajes: data.messages,
      mensajesListos: data.messages_ready,
      mensajesNoConfirmados: data.messages_unacknowledged,
      consumidores: data.consumers,
      politicas: data.arguments,
    };
  }

  async purgarCola(nombre: string): Promise<void> {
    await this.http.delete(
      `/api/queues/${this.vhost}/${encodeURIComponent(nombre)}/contents`,
    );
  }

  async listarExchanges() {
    const propios = [EXCHANGE_EVENTOS, EXCHANGE_COMANDOS, EXCHANGE_DLX];
    const { data } = await this.http.get(`/api/exchanges/${this.vhost}`);
    return data
      .filter((e: any) => propios.includes(e.name))
      .map((e: any) => ({ nombre: e.name, tipo: e.type, durable: e.durable }));
  }

  async listarBindings() {
    const { data } = await this.http.get(`/api/bindings/${this.vhost}`);
    return data
      .filter((b: any) => b.source && b.destination)
      .map((b: any) => ({
        origen: b.source,
        destino: b.destination,
        routingKey: b.routing_key,
      }));
  }

  async estadoNodos() {
    const { data } = await this.http.get('/api/nodes');
    return data.map((n: any) => ({
      nombre: n.name,
      corriendo: n.running,
      memoriaUsadaMb: Math.round(n.mem_used / (1024 * 1024)),
      colasAsociadas: n.local_pending_raft_commands ?? 0,
    }));
  }

  async mensajesMuertosPorCola() {
    const colas = await this.listarColas();
    return COLAS.map((c) => {
      const dlq = colas.find((x: any) => x.nombre === c.dlq);
      return { cola: c.nombre, dlq: c.dlq, mensajesEnDlq: dlq?.mensajes ?? 0 };
    });
  }

  async aplicarPolitica(dto: AplicarPoliticaDto): Promise<void> {
    await this.http.put(
      `/api/policies/${this.vhost}/${encodeURIComponent(dto.nombrePolitica)}`,
      {
        pattern: dto.patron,
        definition: {
          'max-length': dto.maxLength,
          'message-ttl': dto.ttlMs,
          overflow: dto.overflow ?? 'reject-publish-dlx',
        },
        'apply-to': 'queues',
        priority: 0,
      },
    );
  }
}