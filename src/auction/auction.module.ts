import { Module } from '@nestjs/common';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { AuctionGateway } from './auction.gateway';
import { BidModule } from '../bid/bid.module';
import { RedisModule } from '../redis/redis.module';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [BidModule, RedisModule, RabbitmqModule, AuthModule],
  controllers: [AuctionController],
  providers: [AuctionService, AuctionGateway, PrismaService],
})
export class AuctionModule {}