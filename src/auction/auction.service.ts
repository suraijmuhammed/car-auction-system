import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AuctionService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private rabbitmq: RabbitmqService,
  ) {
    this.rabbitmq.consumeBidProcessing(this.processBidEvent.bind(this));
  }

  async onModuleInit() {
    // Check for expired auctions on startup
    await this.checkExpiredAuctions();
  }

  //  Automatic auction end detection (runs every 30 seconds)
  @Cron('*/30 * * * * *') // Every 30 seconds
  async checkExpiredAuctions() {
    try {
      const now = new Date();
      
      // Find all active auctions that have passed their end time
      const expiredAuctions = await this.prisma.auction.findMany({
        where: {
          status: 'ACTIVE',
          endTime: {
            lte: now // Less than or equal to current time
          }
        },
        include: {
          bids: {
            orderBy: { amount: 'desc' },
            take: 1,
            include: { user: true }
          }
        }
      });

      // End each expired auction
      for (const auction of expiredAuctions) {
        await this.endAuction(auction.id);
        console.log(`Auto-ended expired auction: ${auction.carId}`);
      }

    } catch (error) {
      console.error('Error checking expired auctions:', error);
    }
  }

  async createAuction(auctionData: {
    carId: string;
    startTime: Date;
    endTime: Date;
    startingBid: number;
    carImages?: string[];
    carDescription?: string;
    carYear?: number;
    carMake?: string;
    carModel?: string;
  }) {
    const auction = await this.prisma.auction.create({
      data: {
        ...auctionData,
        currentHighestBid: auctionData.startingBid,
      },
    });

    await this.rabbitmq.publishAuditLog({
      action: 'AUCTION_CREATED',
      auctionId: auction.id,
      timestamp: new Date(),
      data: auctionData,
    });

    console.log(`New auction created: ${auction.carId} (${auction.id})`);
    console.log(`Auction ends at: ${auction.endTime.toLocaleString()}`);
    return auction;
  }

  async getAuction(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        bids: {
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
          take: 20,
        },
      },
    });

    //  Check if auction should be ended
    if (auction && auction.status === 'ACTIVE' && new Date() > auction.endTime) {
      console.log(`Auto-ending expired auction during fetch: ${auction.carId}`);
      return await this.endAuction(auction.id);
    }

    return auction;
  }

  async getActiveAuctions() {
    // Get all auctions first
    const auctions = await this.prisma.auction.findMany({
      orderBy: { startTime: 'asc' },
    });

    // Check each auction for expiry and update status
    const updatedAuctions = [];
    const now = new Date();

    for (const auction of auctions) {
      if (auction.status === 'ACTIVE' && now > auction.endTime) {
        // Auto-end expired auction
        console.log(` Auto-ending expired auction in list: ${auction.carId}`);
        const endedAuction = await this.endAuction(auction.id);
        updatedAuctions.push(endedAuction);
      } else {
        updatedAuctions.push(auction);
      }
    }

    return updatedAuctions.map(auction => ({
      ...auction,
      carImages: this.getCarImages(auction.carId),
      carDetails: this.getCarDetails(auction.carId),
    }));
  }

  //  End auction with proper notifications for all participants
  async endAuction(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          include: { user: true },
        },
      },
    });

    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.status === 'ENDED') {
      console.log(`Auction ${auctionId} already ended`);
      return auction;
    }

    const winningBid = auction.bids[0];
    const uniqueParticipants = [...new Set(auction.bids.map(bid => bid.userId))];
    
    const updatedAuction = await this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'ENDED',
        winnerId: winningBid?.userId || null,
      },
      include: {
        bids: {
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
          take: 20,
        },
      },
    });

    // Send notifications based on auction outcome
    if (winningBid && auction.bids.length > 0) {
      // Auction had bids - send appropriate notifications
      
      // Winner notification
      await this.rabbitmq.publishNotification({
        type: 'AUCTION_WON',
        userId: winningBid.userId,
        auctionId,
        message: `🏆 Congratulations! You won the ${auction.carYear} ${auction.carMake} ${auction.carModel} auction with a bid of ${winningBid.amount.toLocaleString()}!`,
        carDetails: `${auction.carYear} ${auction.carMake} ${auction.carModel}`,
        winningBid: winningBid.amount
      });

      // Notify all other participants they lost
      for (const participantId of uniqueParticipants) {
        if (participantId !== winningBid.userId) {
          await this.rabbitmq.publishNotification({
            type: 'AUCTION_LOST',
            userId: participantId,
            auctionId,
            message: `The ${auction.carYear} ${auction.carMake} ${auction.carModel} auction has ended. Winning bid: ${winningBid.amount.toLocaleString()} by ${winningBid.user.username}`,
            carDetails: `${auction.carYear} ${auction.carMake} ${auction.carModel}`,
            winningBid: winningBid.amount,
            winner: winningBid.user.username
          });
        }
      }

      console.log(` Auction ended: ${auctionId}`);
      console.log(` Winner: ${winningBid.user.username} with ${winningBid.amount.toLocaleString()}`);
      console.log(`📧Sent notifications to ${uniqueParticipants.length} participants`);
      
    } else {
      // 🔧 NEW: No bids received - different handling
      console.log(` Auction ended: ${auctionId} (No bids received)`);
      
      // General auction end notification (for watchers/interested users)
      await this.rabbitmq.publishNotification({
        type: 'AUCTION_ENDED_NO_BIDS',
        auctionId,
        message: ` The ${auction.carYear} ${auction.carMake} ${auction.carModel} auction has ended with no bids received.`,
        carDetails: `${auction.carYear} ${auction.carMake} ${auction.carModel}`,
        startingBid: auction.startingBid
      });
    }

    await this.rabbitmq.publishAuditLog({
      action: 'AUCTION_ENDED',
      auctionId,
      winnerId: winningBid?.userId || null,
      winningAmount: winningBid?.amount || null,
      totalBids: auction.bids.length,
      uniqueParticipants: uniqueParticipants.length,
      timestamp: new Date(),
    });

    return updatedAuction;
  }

  // Helper methods (unchanged)
  private getCarImages(carId: string): string[] {
    const carImageMap = {
      'ferrari-f8-tributo-2023': [
        'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=800&q=80&auto=format&fit=crop'
      ],
      'lamborghini-huracan-evo-2023': [
        
        'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1566473965997-3de9c817e938?w=800&q=80&auto=format&fit=crop'
      ],
      'porsche-911-gt3-rs-2023': [
        
        'https://images.unsplash.com/photo-1614200179396-2bdb240afe75?w=800&q=80&auto=format&fit=crop'
      ]
    };
    
    return carImageMap[carId] || ['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80&auto=format&fit=crop'];
  }

  private getCarDetails(carId: string): any {
    const carDetailsMap = {
      'ferrari-f8-tributo-2023': {
        make: 'Ferrari',
        model: 'F8 Tributo',
        year: 2023,
        description: 'The Ferrari F8 Tributo is a mid-engine sports car produced by Ferrari. The car is the successor to the 488 GTB and pays tribute to the most powerful V8 in Ferrari history.',
        specs: {
          engine: 'V8 Twin-Turbo',
          power: '710 HP',
          torque: '568 lb-ft',
          topSpeed: '211 mph',
          acceleration: '0-60 mph in 2.9s'
        }
      },
      'lamborghini-huracan-evo-2023': {
        make: 'Lamborghini',
        model: 'Huracán EVO',
        year: 2023,
        description: 'The Lamborghini Huracán EVO is the evolution of the most successful V10-powered Lamborghini ever.',
        specs: {
          engine: 'V10 Naturally Aspirated',
          power: '630 HP',
          torque: '443 lb-ft',
          topSpeed: '202 mph',
          acceleration: '0-60 mph in 2.9s'
        }
      },
      'porsche-911-gt3-rs-2023': {
        make: 'Porsche',
        model: '911 GT3 RS',
        year: 2023,
        description: 'The Porsche 911 GT3 RS is a track-focused variant of the Porsche 911 sports car.',
        specs: {
          engine: 'Flat-6 Naturally Aspirated',
          power: '518 HP',
          torque: '346 lb-ft',
          topSpeed: '184 mph',
          acceleration: '0-60 mph in 3.0s'
        }
      }
    };
    
    return carDetailsMap[carId] || {
      make: 'Luxury',
      model: 'Sports Car',
      year: 2023,
      description: 'Premium sports car with exceptional performance.',
      specs: {}
    };
  }

  private async processBidEvent(bidData: any) {
    console.log('🔄 Processing bid event:', bidData);
    
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