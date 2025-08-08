import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuctionModule } from './auction/auction.module';
import { BidModule } from './bid/bid.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { NotificationService } from './notification/notification.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), 
    AuthModule,
    AuctionModule,
    BidModule,
    UserModule,
    RedisModule,
    RabbitmqModule,
  ],
  providers: [NotificationService],
})
export class AppModule {}