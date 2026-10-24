import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { LARGO_MAXIMO_NOMBRE, mensajeNombre, PATRON_NOMBRE } from './nombre-recurso';

const m = mensajeNombre('nombre');

/** Parámetro :nombre de las rutas DELETE de colas y exchanges. */
export class NombreParamDto {
  @IsString({ message: m.texto })
  @IsNotEmpty({ message: m.vacio })
  @MaxLength(LARGO_MAXIMO_NOMBRE, { message: m.largo })
  @Matches(PATRON_NOMBRE, { message: m.patron })
  nombre!: string;
}

/** Parámetro :id de POST /v1/admin/dlq/:id/reproceso (fila de mensajes_muertos). */
export class IdParamDto {
  @IsUUID(undefined, { message: 'id debe ser un UUID válido' })
  id!: string;
}
