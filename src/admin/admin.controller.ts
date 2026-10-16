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
import { JwtGuard } from '../../auth/jwt.guard';
import { RolGuard } from '../../auth/rol.guard';
import { RabbitAdminService } from './rabbit-admin.service';
import { AplicarPoliticaDto } from './dto/aplicar-politica.dto';

@Controller('v1/admin')
@UseGuards(JwtGuard, RolGuard)
export class AdminController {
  constructor(private readonly rabbitAdmin: RabbitAdminService) {}

  @Get('colas')
  listarColas() {
    return this.rabbitAdmin.listarColas();
  }

  @Get('colas/:nombre')
  detalleCola(@Param('nombre') nombre: string) {
    return this.rabbitAdmin.detalleCola(nombre);
  }

  @Delete('colas/:nombre/mensajes')
  @HttpCode(204)
  async purgarCola(@Param('nombre') nombre: string): Promise<void> {
    await this.rabbitAdmin.purgarCola(nombre);
  }

  @Get('exchanges')
  listarExchanges() {
    return this.rabbitAdmin.listarExchanges();
  }

  @Get('bindings')
  listarBindings() {
    return this.rabbitAdmin.listarBindings();
  }

  @Get('nodos')
  estadoNodos() {
    return this.rabbitAdmin.estadoNodos();
  }

  @Get('mensajes-muertos')
  mensajesMuertos() {
    return this.rabbitAdmin.mensajesMuertosPorCola();
  }

  @Post('politicas')
  @HttpCode(201)
  async aplicarPolitica(@Body() dto: AplicarPoliticaDto): Promise<void> {
    await this.rabbitAdmin.aplicarPolitica(dto);
  }
}