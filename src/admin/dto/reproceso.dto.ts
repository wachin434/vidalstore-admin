import { IsObject, IsOptional } from 'class-validator';

export class ReprocesoDto {
  /** Payload corregido. Si no viene, se reprocesa el payload original. */
  @IsOptional()
  @IsObject({ message: 'payloadCorregido debe ser un objeto JSON' })
  payloadCorregido?: Record<string, unknown>;
}
