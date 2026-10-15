import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { RabbitAdminService } from './admin/rabbit-admin.service';
import { MensajeriaService } from './mensajeria/mensajeria.service';
 
@Module({
  controllers: [AdminController],
  providers: [RabbitAdminService, MensajeriaService],
})
export class AppModule {}