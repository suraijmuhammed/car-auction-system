import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class AuctionService {
  constructor(
    private prisma: PrismaService,
    private rabbitmq: RabbitmqService,
  ) {
    // Start consuming bid processing queue
    this.rabbitmq.consumeBidProcessing(this.processBidEvent.bind(this));
  }

  async createAuction(auctionData: {
    carId: string;
    startTime: Date;
    endTime: Date;
    startingBid: number;
  }) {
    const auction = await this.prisma.auction.create({
      data: auctionData,
    });

    // Log auction creation
    await this.rabbitmq.publishAuditLog({
      action: 'AUCTION_CREATED',
      auctionId: auction.id,
      timestamp: new Date(),
      data: auctionData,
    });

    console.log(`🏛️ New auction created: ${auction.carId} (${auction.id})`);
    return auction;
  }

  async getAuction(id: string) {
    return await this.prisma.auction.findUnique({
      where: { id },
      include: {
        bids: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async getActiveAuctions() {
    return await this.prisma.auction.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { startTime: 'asc' },
    });
  }

  async endAuction(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
          include: { user: true },
        },
      },
    });

    if (!auction) {
      throw new Error('Auction not found');
    }

    const winningBid = auction.bids[0];
    
    const updatedAuction = await this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'ENDED',
        winnerId: winningBid?.userId,
      },
    });

    // Send notification to winner
    if (winningBid) {
      await this.rabbitmq.publishNotification({
        type: 'AUCTION_WON',
        userId: winningBid.userId,
        auctionId,
        message: `🎉 Congratulations! You won the auction with a bid of $${winningBid.amount}`,
      });
    }

    console.log(`🏁 Auction ended: ${auctionId}, Winner: ${winningBid?.user.username || 'None'}`);
    return updatedAuction;
  }

  private async processBidEvent(bidData: any) {
    // Process bid event (additional business logic)
    console.log('🔄 Processing bid event:', bidData);
    
    // Log for audit
    await this.rabbitmq.publishAuditLog({
      action: 'BID_PROCESSED',
      bidId: bidData.bidId,
      auctionId: bidData.auctionId,
      userId: bidData.userId,
      amount: bidData.amount,
      timestamp: new Date(),
    });
  }
}