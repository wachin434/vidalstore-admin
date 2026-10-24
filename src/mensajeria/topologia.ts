import type { Channel } from 'amqplib';

/**
 * Topología de mensajería de vidalstore-admin.
 *
 * Este proyecto solo PUBLICA un comando (dlq.reprocesar) en vidalstore.comandos,
 * así que declara únicamente ese exchange y esa routing key. No conoce ninguna
 * cola: quien quiera enterarse (vidalstore-eventos) declara la suya.
 * Los nombres tienen que ser idénticos a los de los otros proyectos.
 */
export const EXCHANGE_COMANDOS = 'vidalstore.comandos';

export const RK_DLQ_REPROCESAR = 'dlq.reprocesar';

export async function declararTopologia(channel: Channel): Promise<void> {
  await channel.assertExchange(EXCHANGE_COMANDOS, 'direct', { durable: true });
}
