import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { RolGuard } from '../auth/rol.guard';
import { KafkaAdminService } from './kafka-admin.service';
import { KafkaController } from './kafka.controller';

// E3: el administrador de Kafka. KAFKA_BROKERS sale del entorno (compose local o el .env de gestion en AWS).
@Module({
  controllers: [KafkaController],
  providers: [KafkaAdminService, JwtGuard, RolGuard],
})
export class KafkaModule {}
