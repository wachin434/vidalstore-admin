import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { RolGuard } from '../auth/rol.guard';
import { UsuarioSub } from '../auth/usuario-sub.decorator';
import { RabbitAdminService } from './rabbit-admin.service';
import { CrearColaDto } from './dto/crear-cola.dto';
import { CrearExchangeDto } from './dto/crear-exchange.dto';
import { BindingDto } from './dto/binding.dto';
import { IdParamDto, NombreParamDto } from './dto/params.dto';
import { ReprocesoDto } from './dto/reproceso.dto';

/**
 * Solo recibe la petición, la valida (DTOs) y llama a un método de alto nivel
 * de RabbitAdminService. No conoce amqplib ni la API HTTP del broker.
 * Las rutas exigen token de Cognito válido y el grupo `administradores`,
 * incluidos los GET.
 */
@Controller('v1/admin')
@UseGuards(JwtGuard, RolGuard)
export class AdminController {
  constructor(private readonly rabbitAdmin: RabbitAdminService) {}

  @Get('colas')
  listarColas() {
    return this.rabbitAdmin.listarColas();
  }

  @Post('colas')
  @HttpCode(201)
  crearCola(@Body() dto: CrearColaDto) {
    return this.rabbitAdmin.crearCola(dto);
  }

  @Delete('colas/:nombre')
  @HttpCode(204)
  async eliminarCola(@Param() params: NombreParamDto): Promise<void> {
    await this.rabbitAdmin.eliminarCola(params.nombre);
  }

  @Get('exchanges')
  listarExchanges() {
    return this.rabbitAdmin.listarExchanges();
  }

  @Post('exchanges')
  @HttpCode(201)
  crearExchange(@Body() dto: CrearExchangeDto) {
    return this.rabbitAdmin.crearExchange(dto);
  }

  @Delete('exchanges/:nombre')
  @HttpCode(204)
  async eliminarExchange(@Param() params: NombreParamDto): Promise<void> {
    await this.rabbitAdmin.eliminarExchange(params.nombre);
  }

  @Post('bindings')
  @HttpCode(201)
  crearBinding(@Body() dto: BindingDto) {
    return this.rabbitAdmin.crearBinding(dto);
  }

  @Delete('bindings')
  @HttpCode(204)
  async eliminarBinding(@Body() dto: BindingDto): Promise<void> {
    await this.rabbitAdmin.eliminarBinding(dto);
  }

  /** Solo grupos de 3 (punto 4.9). El sub de quien pide sale del token. */
  @Post('dlq/:id/reproceso')
  @HttpCode(202)
  reprocesar(
    @Param() params: IdParamDto,
    @Body() dto: ReprocesoDto,
    @UsuarioSub() solicitadoPor: string,
  ) {
    return this.rabbitAdmin.solicitarReproceso(params.id, dto.payloadCorregido, solicitadoPor);
  }
}
