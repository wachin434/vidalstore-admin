/**
 * Regla única para los nombres de colas y exchanges: obligatorio, no vacío,
 * sin espacios, largo máximo y patrón declarado (letras, números, punto,
 * guión y guión bajo).
 */
export const PATRON_NOMBRE = /^[A-Za-z0-9._-]+$/;
export const LARGO_MAXIMO_NOMBRE = 100;
export const LARGO_MAXIMO_ROUTING_KEY = 255;
export const TIPOS_EXCHANGE = ['direct', 'topic', 'fanout', 'headers'] as const;
export type TipoExchange = (typeof TIPOS_EXCHANGE)[number];

export const mensajeNombre = (campo: string) => ({
  vacio: `${campo} es obligatorio y no puede estar vacío`,
  texto: `${campo} debe ser un texto`,
  largo: `${campo} no puede superar ${LARGO_MAXIMO_NOMBRE} caracteres`,
  patron: `${campo} solo admite letras, números, punto, guión y guión bajo (sin espacios)`,
});
