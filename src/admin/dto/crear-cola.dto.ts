import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { LARGO_MAXIMO_NOMBRE, mensajeNombre, PATRON_NOMBRE } from './nombre-recurso';

const m = mensajeNombre('nombre');

export class CrearColaDto {
  @IsString({ message: m.texto })
  @IsNotEmpty({ message: m.vacio })
  @MaxLength(LARGO_MAXIMO_NOMBRE, { message: m.largo })
  @Matches(PATRON_NOMBRE, { message: m.patron })
  nombre!: string;

  @IsOptional()
  @IsBoolean({ message: 'durable debe ser true o false' })
  durable?: boolean = true;
}
