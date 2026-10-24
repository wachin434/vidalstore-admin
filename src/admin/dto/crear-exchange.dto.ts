import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  LARGO_MAXIMO_NOMBRE,
  mensajeNombre,
  PATRON_NOMBRE,
  TIPOS_EXCHANGE,
  TipoExchange,
} from './nombre-recurso';

const m = mensajeNombre('nombre');

export class CrearExchangeDto {
  @IsString({ message: m.texto })
  @IsNotEmpty({ message: m.vacio })
  @MaxLength(LARGO_MAXIMO_NOMBRE, { message: m.largo })
  @Matches(PATRON_NOMBRE, { message: m.patron })
  nombre!: string;

  @IsIn(TIPOS_EXCHANGE as unknown as string[], {
    message: `tipo debe ser uno de: ${TIPOS_EXCHANGE.join(', ')}`,
  })
  tipo!: TipoExchange;

  @IsOptional()
  @IsBoolean({ message: 'durable debe ser true o false' })
  durable?: boolean = true;
}
