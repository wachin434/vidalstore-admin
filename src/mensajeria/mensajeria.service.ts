import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as amqp from 'amqplib';
import { declararTopologia } from './topologia';

/**
 * Conexión de publicación con el broker. Solo publica: vidalstore-admin no
 * consume ninguna cola.
 */
@Injectable()
export class MensajeriaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MensajeriaService.name);
  private conexion!: amqp.ChannelModel;
  private canalPublicacion!: amqp.ConfirmChannel;

  async onModuleInit(): Promise<void> {
    const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
    this.conexion = await amqp.connect(url);

    this.conexion.on('error', (err) =>
      this.logger.error(`Conexión RabbitMQ perdida: ${err.message}`),
    );

    this.canalPublicacion = await this.conexion.createConfirmChannel();
    await declararTopologia(this.canalPublicacion);

    this.logger.log('Topología de mensajería declarada correctamente');
  }

  async onModuleDestroy(): Promise<void> {
    await this.canalPublicacion?.close();
    await this.conexion?.close();
  }

  /**
   * Publica con confirmación del broker, persistent: true, content-type JSON y
   * los dos headers propios de VidalStore: x-evento-id (UUID) y x-emitido-en
   * (ISO 8601). Devuelve el x-evento-id usado.
   */
  async publicar(
    exchange: string,
    routingKey: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const eventoId = randomUUID();
    const buffer = Buffer.from(JSON.stringify(payload));
    await new Promise<void>((resolve, reject) => {
      this.canalPublicacion.publish(
        exchange,
        routingKey,
        buffer,
        {
          contentType: 'application/json',
          persistent: true,
          headers: {
            'x-evento-id': eventoId,
            'x-emitido-en': new Date().toISOString(),
          },
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    return eventoId;
  }
}
