import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: RedisClientType;
  private publisher: RedisClientType;
  private subscriber: RedisClientType;

  async onModuleInit() {
    this.client = createClient({ url: 'redis://localhost:6379' });
    this.publisher = createClient({ url: 'redis://localhost:6379' });
    this.subscriber = createClient({ url: 'redis://localhost:6379' });
    
    await this.client.connect();
    await this.publisher.connect();
    await this.subscriber.connect();
    
    console.log('🔴 Connected to Redis');
  }

  // Cache current highest bid for each auction
  async cacheHighestBid(auctionId: string, bid: any): Promise<void> {
    await this.client.setEx(`auction:${auctionId}:highest`, 3600, JSON.stringify(bid));
  }

  async getHighestBid(auctionId: string): Promise<any> {
    const cached = await this.client.get(`auction:${auctionId}:highest`);
    return cached ? JSON.parse(cached) : null;
  }

  // Pub/Sub for real-time updates
  async publishBidUpdate(auctionId: string, bidData: any): Promise<void> {
    await this.publisher.publish(`auction:${auctionId}:bids`, JSON.stringify(bidData));
  }

  async subscribeToBidUpdates(auctionId: string, callback: (data: any) => void): Promise<void> {
    await this.subscriber.subscribe(`auction:${auctionId}:bids`, (message) => {
      callback(JSON.parse(message));
    });
  }

  // Session management
  async setUserSession(userId: string, socketId: string): Promise<void> {
    await this.client.setEx(`session:${userId}`, 7200, socketId);
  }

  async getUserSession(userId: string): Promise<string | null> {
    return await this.client.get(`session:${userId}`);
  }
}