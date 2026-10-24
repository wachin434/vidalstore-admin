import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  LARGO_MAXIMO_NOMBRE,
  LARGO_MAXIMO_ROUTING_KEY,
  mensajeNombre,
  PATRON_NOMBRE,
} from './nombre-recurso';

const mx = mensajeNombre('exchange');
const mc = mensajeNombre('cola');

/** Cuerpo de POST y DELETE /v1/admin/bindings. */
export class BindingDto {
  @IsString({ message: mx.texto })
  @IsNotEmpty({ message: mx.vacio })
  @MaxLength(LARGO_MAXIMO_NOMBRE, { message: mx.largo })
  @Matches(PATRON_NOMBRE, { message: mx.patron })
  exchange!: string;

  @IsString({ message: mc.texto })
  @IsNotEmpty({ message: mc.vacio })
  @MaxLength(LARGO_MAXIMO_NOMBRE, { message: mc.largo })
  @Matches(PATRON_NOMBRE, { message: mc.patron })
  cola!: string;

  @IsString({ message: 'routingKey debe ser un texto' })
  @IsNotEmpty({ message: 'routingKey es obligatoria y no puede estar vacía' })
  @MaxLength(LARGO_MAXIMO_ROUTING_KEY, {
    message: `routingKey no puede superar ${LARGO_MAXIMO_ROUTING_KEY} caracteres`,
  })
  routingKey!: string;
}
