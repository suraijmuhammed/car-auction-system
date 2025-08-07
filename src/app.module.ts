import { Module } from '@nestjs/common';
import { AuctionModule } from './auction/auction.module';
import { BidModule } from './bid/bid.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    AuthModule,
    AuctionModule,
    BidModule,
    UserModule,
    RedisModule,
    RabbitmqModule,
  ],
})
export class AppModule {}