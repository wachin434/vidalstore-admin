import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

// Un Admin de Kafka de mentira: lo que se prueba son las reglas del servicio, no el cluster.
const admin = {
  listTopics: jest.fn(),
  metadata: jest.fn(),
  createPartitions: jest.fn(),
  deleteTopics: jest.fn(),
  listGroups: jest.fn(),
  describeGroups: jest.fn(),
  listConsumerGroupOffsets: jest.fn(),
  listOffsets: jest.fn(),
  alterConsumerGroupOffsets: jest.fn(),
  describeConfigs: jest.fn(),
  close: jest.fn(),
};
jest.mock('@platformatic/kafka', () => ({
  Admin: jest.fn(() => admin),
  ConfigResourceTypes: { TOPIC: 2 },
  ConfigSources: { DYNAMIC_TOPIC_CONFIG: 1 },
  IncrementalAlterConfigOperationTypes: { SET: 0 },
}));

import { KafkaAdminService } from './kafka-admin.service';

describe('KafkaAdminService', () => {
  let servicio: KafkaAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    servicio = new KafkaAdminService();
    admin.listTopics.mockResolvedValue(['vidalstore.compras']);
    admin.metadata.mockResolvedValue({ topics: new Map([['vidalstore.compras', { partitionsCount: 3, partitions: [] }]]) });
  });

  it('no permite disminuir las particiones: 400 que explica por qué, y no llama a Kafka', async () => {
    await expect(servicio.aumentarParticiones('vidalstore.compras', 2)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.aumentarParticiones('vidalstore.compras', 2)).rejects.toThrow(/no permite disminuirlas/);
    expect(admin.createPartitions).not.toHaveBeenCalled();
  });

  it('un topic de VidalStore no se borra sin repetir su nombre en ?confirmar=', async () => {
    await expect(servicio.borrarTopic('vidalstore.compras')).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.borrarTopic('vidalstore.compras', 'otro')).rejects.toThrow(/confirmar=vidalstore.compras/);
    expect(admin.deleteTopics).not.toHaveBeenCalled();
  });

  it('con el nombre repetido sí lo borra', async () => {
    admin.deleteTopics.mockResolvedValue(undefined);
    await expect(servicio.borrarTopic('vidalstore.compras', 'vidalstore.compras')).resolves.toEqual({
      borrado: 'vidalstore.compras',
      particiones: 3,
    });
    expect(admin.deleteTopics).toHaveBeenCalledTimes(1);
  });

  it('un topic que no existe es 404', async () => {
    await expect(servicio.borrarTopic('no.existe')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no toca los topics internos de Kafka', async () => {
    await expect(servicio.borrarTopic('__consumer_offsets')).rejects.toThrow(/topic interno/);
  });

  it('rebobinar un grupo con consumidores conectados es 409 y no cambia nada', async () => {
    admin.listGroups.mockResolvedValue(new Map([['vidalstore-historial', {}]]));
    admin.describeGroups.mockResolvedValue(new Map([['vidalstore-historial', { state: 'STABLE', members: new Map([['m1', {}]]) }]]));
    await expect(servicio.rebobinar('vidalstore-historial', { hacia: 'principio' })).rejects.toBeInstanceOf(ConflictException);
    expect(admin.alterConsumerGroupOffsets).not.toHaveBeenCalled();
  });

  it('rebobinar un grupo que no existe es 404', async () => {
    admin.listGroups.mockResolvedValue(new Map());
    await expect(servicio.rebobinar('fantasma', { hacia: 'final' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
