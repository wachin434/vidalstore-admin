import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { RabbitAdminService } from './admin/rabbit-admin.service';
import { KafkaModule } from './kafka/kafka.module';
import { MensajeriaService } from './mensajeria/mensajeria.service';
 
@Module({
  imports: [KafkaModule],
  controllers: [AdminController],
  providers: [RabbitAdminService, MensajeriaService],
})
export class AppModule {}