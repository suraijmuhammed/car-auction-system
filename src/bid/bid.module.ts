import { Module } from '@nestjs/common';
import { BidService } from './bid.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [RedisModule, RabbitmqModule],
  providers: [BidService, PrismaService],
  exports: [BidService],
})
export class BidModule {}