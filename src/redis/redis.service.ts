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
    
    console.log('Connected to Redis');
  }

  // Cache current highest bid for each auction
  async cacheHighestBid(auctionId: string, bid: any): Promise<void> {
    await this.client.setEx(`auction:${auctionId}:highest`, 3600, JSON.stringify(bid));
  }

  async getHighestBid(auctionId: string): Promise<any> {
    const cached = await this.client.get(`auction:${auctionId}:highest`);
    return cached ? JSON.parse(cached) : null;
  }

  // New: Persistent bid history in Redis
  async addToBidHistory(auctionId: string, bidData: any): Promise<void> {
    const key = `auction:${auctionId}:history`;
    await this.client.lPush(key, JSON.stringify(bidData));
    await this.client.lTrim(key, 0, 49); // Keep last 50 bids
    await this.client.expire(key, 86400 * 7); // 7 days expiry
  }

  async getBidHistory(auctionId: string): Promise<any[]> {
    const key = `auction:${auctionId}:history`;
    const history = await this.client.lRange(key, 0, -1);
    return history.map(item => JSON.parse(item));
  }

  //  Enhanced: User session with bid tracking
  async setUserSession(userId: string, data: any): Promise<void> {
    await this.client.setEx(`session:${userId}`, 7200, JSON.stringify(data));
  }

  async getUserSession(userId: string): Promise<any> {
    const session = await this.client.get(`session:${userId}`);
    return session ? JSON.parse(session) : null;
  }

  // Enhanced: DDoS protection with progressive penalties
  async checkRateLimit(identifier: string, limit: number = 10, window: number = 60): Promise<boolean> {
    const key = `rate_limit:${identifier}`;
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, window);
    }
    
    // Progressive penalties for heavy abuse
    if (current > limit * 2) {
      await this.client.expire(key, window * 5); // 5x longer penalty
    }
    
    return current <= limit;
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
}