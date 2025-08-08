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

      // ✅ Fixed: Ensure bid is higher than BOTH starting bid AND current highest
      const minimumBid = Math.max(auction.startingBid, auction.currentHighestBid);
      
      if (amount <= minimumBid) {
        throw new Error(`Bid must be higher than $${minimumBid.toLocaleString()}`);
      }

      if (new Date() > auction.endTime) {
        throw new Error('Auction has ended');
      }

      // Prevent user from bidding against themselves
      const userLastBid = await tx.bid.findFirst({
        where: { 
          auctionId,
          userId,
          amount: auction.currentHighestBid
        }
      });

      if (userLastBid) {
        throw new Error('You cannot bid against yourself');
      }

      // Create the bid
      const bid = await tx.bid.create({
        data: {
          userId,
          auctionId,
          amount,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
        },
      });

      // Update auction with new highest bid
      await tx.auction.update({
        where: { id: auctionId },
        data: { currentHighestBid: amount },
      });

      // ✅ Enhanced: Cache bid in Redis with extended data for persistence
      const bidCache = {
        bidId: bid.id,
        amount,
        userId,
        username: bid.user.username,
        fullName: bid.user.fullName,
        timestamp: bid.timestamp,
        auctionId,
      };
      
      await this.redis.cacheHighestBid(auctionId, bidCache);
      // ✅ Also store in persistent bid history
      await this.redis.addToBidHistory(auctionId, bidCache);

      // Publish to RabbitMQ for processing
      await this.rabbitmq.publishBidEvent({
        bidId: bid.id,
        auctionId,
        userId,
        amount,
        timestamp: bid.timestamp,
        username: bid.user.username,
      });

      // Publish real-time update via Redis
      await this.redis.publishBidUpdate(auctionId, {
        bidId: bid.id,
        amount,
        userId,
        username: bid.user.username,
        fullName: bid.user.fullName,
        timestamp: bid.timestamp,
      });

      console.log(`💰 New bid: $${amount} by ${bid.user.username} on auction ${auctionId}`);
      return bid;
    });
  }

  // ✅ Enhanced: Get complete bid history from database
  async getAuctionBids(auctionId: string) {
    return await this.prisma.bid.findMany({
      where: { auctionId },
      include: { 
        user: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        } 
      },
      orderBy: { timestamp: 'desc' },
      take: 50, // Limit for performance
    });
  }

  // ✅ New: Get user's bid history
  async getUserBidHistory(userId: string) {
    return await this.prisma.bid.findMany({
      where: { userId },
      include: {
        auction: {
          select: {
            id: true,
            carId: true,
            status: true,
            currentHighestBid: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });
  }

  // ✅ New: Get auction statistics
  async getAuctionStats(auctionId: string) {
    const [bidCount, uniqueBidders, avgBid] = await Promise.all([
      this.prisma.bid.count({ where: { auctionId } }),
      this.prisma.bid.groupBy({
        by: ['userId'],
        where: { auctionId },
        _count: { userId: true }
      }),
      this.prisma.bid.aggregate({
        where: { auctionId },
        _avg: { amount: true }
      })
    ]);

    return {
      totalBids: bidCount,
      uniqueBidders: uniqueBidders.length,
      averageBid: avgBid._avg.amount || 0,
    };
  }
}