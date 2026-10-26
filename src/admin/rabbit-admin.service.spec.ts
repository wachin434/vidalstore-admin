import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { RabbitAdminService } from './rabbit-admin.service';
import { CrearColaDto } from './dto/crear-cola.dto';
import { CrearExchangeDto } from './dto/crear-exchange.dto';
import { BindingDto } from './dto/binding.dto';

const axiosError = (status: number, reason: string) =>
  Object.assign(new Error('x'), { isAxiosError: true, response: { status, data: { reason } } });

describe('RabbitAdminService', () => {
  let http: { get: jest.Mock; put: jest.Mock; post: jest.Mock; delete: jest.Mock };
  let mensajeria: { publicar: jest.Mock };
  let servicio: RabbitAdminService;

  beforeEach(() => {
    http = { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() };
    mensajeria = { publicar: jest.fn().mockResolvedValue('evt-1') };
    process.env.RABBITMQ_MGMT_USER = 'usuario-prueba';
    process.env.RABBITMQ_MGMT_PASS = 'clave-prueba';
    servicio = new RabbitAdminService(mensajeria as any);
    (servicio as any).http = http;
  });

  it('falla si falta la credencial de management', () => {
    delete process.env.RABBITMQ_MGMT_PASS;
    expect(() => new RabbitAdminService(mensajeria as any)).toThrow('RABBITMQ_MGMT_PASS');
  });

  it('crea una cola quorum por PUT', async () => {
    http.put.mockResolvedValue({});
    const r = await servicio.crearCola({ nombre: 'cola.x', durable: true });
    expect(http.put).toHaveBeenCalledWith('/api/queues/%2F/cola.x', expect.objectContaining({
      durable: true, arguments: { 'x-queue-type': 'quorum' },
    }));
    expect(r.tipo).toBe('quorum');
  });

  it('crear cola existente con otra config → 409', async () => {
    http.put.mockRejectedValue(axiosError(400, 'PRECONDITION_FAILED - inequivalent arg'));
    await expect(servicio.crearCola({ nombre: 'a', durable: true })).rejects.toBeInstanceOf(ConflictException);
  });

  it('eliminar cola inexistente → 404', async () => {
    http.delete.mockRejectedValue(axiosError(404, 'Not Found'));
    await expect(servicio.eliminarCola('nada')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crear exchange con prefijo amq. → 400 sin llamar al broker', async () => {
    await expect(servicio.crearExchange({ nombre: 'amq.x', tipo: 'direct', durable: true }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(http.put).not.toHaveBeenCalled();
  });

  it('rechazo 400 del broker → 400, no 500', async () => {
    http.put.mockRejectedValue(axiosError(400, 'invalid'));
    await expect(servicio.crearExchange({ nombre: 'e', tipo: 'direct', durable: true }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('broker caído → 503', async () => {
    http.get.mockRejectedValue(Object.assign(new Error('down'), { isAxiosError: true }));
    await expect(servicio.listarColas()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('eliminar binding busca el properties_key correcto', async () => {
    http.get.mockResolvedValue({ data: [
      { routing_key: 'otra', properties_key: 'otra' },
      { routing_key: 'a.b', properties_key: 'a.b' },
    ] });
    http.delete.mockResolvedValue({});
    await servicio.eliminarBinding({ exchange: 'ex', cola: 'q', routingKey: 'a.b' });
    expect(http.delete).toHaveBeenCalledWith('/api/bindings/%2F/e/ex/q/q/a.b');
  });

  it('eliminar binding que no existe → 404', async () => {
    http.get.mockResolvedValue({ data: [] });
    await expect(servicio.eliminarBinding({ exchange: 'ex', cola: 'q', routingKey: 'z' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('reproceso publica dlq.reprocesar con el sub recibido', async () => {
    const r = await servicio.solicitarReproceso('id-1', { a: 1 }, 'sub-admin');
    expect(mensajeria.publicar).toHaveBeenCalledWith('vidalstore.comandos', 'dlq.reprocesar', {
      mensajeMuertoId: 'id-1', solicitadoPor: 'sub-admin', payloadCorregido: { a: 1 },
    });
    expect(r.estado).toBe('solicitado');
  });

  it('reproceso con fallo de publicación → 503', async () => {
    mensajeria.publicar.mockRejectedValue(new Error('nack'));
    await expect(servicio.solicitarReproceso('id', undefined, 's')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('Validación de DTOs (400 claros)', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validar = (valor: any, metatype: any) => pipe.transform(valor, { type: 'body', metatype } as any);
  const mensaje = async (valor: any, metatype: any) => {
    try { await validar(valor, metatype); return null; }
    catch (e: any) { return JSON.stringify(e.getResponse()); }
  };

  it('nombre vacío / con espacios / largo / campo extra', async () => {
    expect(await mensaje({ nombre: '' }, CrearColaDto)).toContain('nombre');
    expect(await mensaje({ nombre: 'a b' }, CrearColaDto)).toContain('sin espacios');
    expect(await mensaje({ nombre: 'a'.repeat(101) }, CrearColaDto)).toContain('100');
    expect(await mensaje({ nombre: 'ok', otro: 1 }, CrearColaDto)).toContain('otro');
  });

  it('durable por defecto true y no booleano rechazado', async () => {
    expect((await validar({ nombre: 'ok' }, CrearColaDto)).durable).toBe(true);
    expect(await mensaje({ nombre: 'ok', durable: 'si' }, CrearColaDto)).toContain('durable');
  });

  it('tipo de exchange inválido', async () => {
    expect(await mensaje({ nombre: 'e', tipo: 'raro' }, CrearExchangeDto)).toContain('direct, topic, fanout, headers');
    expect(await mensaje({ nombre: 'e', tipo: 'topic' }, CrearExchangeDto)).toBeNull();
  });

  it('binding sin routingKey', async () => {
    expect(await mensaje({ exchange: 'e', cola: 'q' }, BindingDto)).toContain('routingKey');
  });
});
