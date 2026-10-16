import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AplicarPoliticaDto {
  @IsString()
  nombrePolitica!: string;

  @IsString()
  patron!: string;

  @IsInt()
  @Min(1)
  maxLength!: number;

  @IsInt()
  @Min(1000)
  ttlMs!: number;

  @IsOptional()
  @IsIn(['drop-head', 'reject-publish', 'reject-publish-dlx'])
  overflow?: 'drop-head' | 'reject-publish' | 'reject-publish-dlx';
}