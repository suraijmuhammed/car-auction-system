import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class BidService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private rabbitmq: RabbitmqService,
  ) {}

  async placeBid(bidData: {
    auctionId: string;
    userId: string;
    amount: number;
  }) {
    const { auctionId, userId, amount } = bidData;

    // Start transaction for concurrency safety
    return await this.prisma.$transaction(async (tx) => {
      // Get current auction
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
      });

      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== 'ACTIVE') {
        throw new Error('Auction is not active');
      }

      if (amount <= auction.currentHighestBid) {
        throw new Error(`Bid must be higher than current highest bid of $${auction.currentHighestBid}`);
      }

      if (new Date() > auction.endTime) {
        throw new Error('Auction has ended');
      }

      // Create the bid
      const bid = await tx.bid.create({
        data: {
          userId,
          auctionId,
          amount,
        },
        include: {
          user: true,
        },
      });

      // Update auction with new highest bid
      await tx.auction.update({
        where: { id: auctionId },
        data: { currentHighestBid: amount },
      });

      // Cache the highest bid in Redis
      const bidCache = {
        bidId: bid.id,
        amount,
        userId,
        username: bid.user.username,
        timestamp: bid.timestamp,
      };
      
      await this.redis.cacheHighestBid(auctionId, bidCache);

      // Publish to RabbitMQ for processing
      await this.rabbitmq.publishBidEvent({
        bidId: bid.id,
        auctionId,
        userId,
        amount,
        timestamp: bid.timestamp,
      });

      // Publish real-time update via Redis
      await this.redis.publishBidUpdate(auctionId, {
        bidId: bid.id,
        amount,
        userId,
        username: bid.user.username,
        timestamp: bid.timestamp,
      });

      console.log(`💰 New bid: $${amount} by ${bid.user.username} on auction ${auctionId}`);
      return bid;
    });
  }

  async getAuctionBids(auctionId: string) {
    return await this.prisma.bid.findMany({
      where: { auctionId },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }
}