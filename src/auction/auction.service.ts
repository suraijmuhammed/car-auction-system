import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class AuctionService {
  constructor(
    private prisma: PrismaService,
    private rabbitmq: RabbitmqService,
  ) {
    this.rabbitmq.consumeBidProcessing(this.processBidEvent.bind(this));
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
        currentHighestBid: auctionData.startingBid, // ✅ Fixed: Start with starting bid
      },
    });

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
  }

  // ✅ Enhanced: Get active auctions with car details and images
  async getActiveAuctions() {
    const auctions = await this.prisma.auction.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { startTime: 'asc' },
    });

    // ✅ Add sample car images (in production, these would come from database)
    return auctions.map(auction => ({
      ...auction,
      carImages: this.getCarImages(auction.carId),
      carDetails: this.getCarDetails(auction.carId),
    }));
  }

  // ✅ Helper: Get car images (sample implementation)
  private getCarImages(carId: string): string[] {
    const carImageMap = {
      'ferrari-f8-tributo-2023': [
        'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800',
        'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800',
        'https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=800'
      ],
      'lamborghini-huracan-evo-2023': [
        'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
        'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800'
      ],
      'porsche-911-gt3-rs-2023': [
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800',
        'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800',
        'https://images.unsplash.com/photo-1544829099-b9a0c5303bea?w=800'
      ]
    };
    
    return carImageMap[carId] || ['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800'];
  }

  // ✅ Helper: Get car details
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
        description: 'The Lamborghini Huracán EVO is the evolution of the most successful V10-powered Lamborghini ever. Every aspect of the EVO experience has been enhanced to deliver superior driving dynamics.',
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
        description: 'The Porsche 911 GT3 RS is a high-performance variant of the Porsche 911 sports car. It is designed for track use while remaining street legal.',
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

    if (winningBid) {
      await this.rabbitmq.publishNotification({
        type: 'AUCTION_WON',
        userId: winningBid.userId,
        auctionId,
        message: `🏆 Congratulations! You won the auction with a bid of $${winningBid.amount.toLocaleString()}`,
      });
    }

    console.log(`🏁 Auction ended: ${auctionId}, Winner: ${winningBid?.user.username || 'None'}`);
    return updatedAuction;
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