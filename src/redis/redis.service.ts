import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private maxRetries = 5;
  private retryDelay = 2000;

  async onModuleInit() {
    await this.connectWithRetry();
  }

  //  Connection with retry logic
  private async connectWithRetry(attempt: number = 1): Promise<void> {
    try {
      this.logger.log(` Connecting to Redis (attempt ${attempt}/${this.maxRetries})...`);
      
      this.client = createClient({ url: 'redis://localhost:6379' });
      this.publisher = createClient({ url: 'redis://localhost:6379' });
      this.subscriber = createClient({ url: 'redis://localhost:6379' });
      
      // Setup error handlers
      this.setupErrorHandlers();
      
      await Promise.all([
        this.client.connect(),
        this.publisher.connect(),
        this.subscriber.connect()
      ]);
      
      this.logger.log(' Connected to Redis with Pub/Sub support');
      
      // Setup global bid update listeners
      await this.setupBidUpdateSubscribers();
      
    } catch (error) {
      this.logger.error(` Redis connection failed (attempt ${attempt}):`, error.message);
      
      if (attempt < this.maxRetries) {
        this.logger.log(`Retrying Redis connection in ${this.retryDelay/1000} seconds...`);
        await this.delay(this.retryDelay);
        return this.connectWithRetry(attempt + 1);
      } else {
        this.logger.error(' Max Redis retries exceeded. Redis will be unavailable.');
      }
    }
  }

  //  Setup error handlers for connection failures
  private setupErrorHandlers() {
    const handleError = (client: string) => (error: Error) => {
      this.logger.error(` Redis ${client} error:`, error.message);
      // Implement reconnection logic if needed
    };

    this.client.on('error', handleError('client'));
    this.publisher.on('error', handleError('publisher'));
    this.subscriber.on('error', handleError('subscriber'));

    const handleReconnect = (client: string) => () => {
      this.logger.log(` Redis ${client} reconnected`);
    };

    this.client.on('connect', handleReconnect('client'));
    this.publisher.on('connect', handleReconnect('publisher'));
    this.subscriber.on('connect', handleReconnect('subscriber'));
  }

  //  Setup global bid update subscribers
  private async setupBidUpdateSubscribers() {
    try {
      // Subscribe to global bid events
      await this.subscriber.subscribe('bid:global', (message) => {
        this.handleGlobalBidUpdate(JSON.parse(message));
      });

      // Subscribe to auction-specific events
      await this.subscriber.pSubscribe('auction:*:bid', (message, channel) => {
        const auctionId = channel.split(':')[1];
        this.handleAuctionBidUpdate(auctionId, JSON.parse(message));
      });

      this.logger.log(' Redis Pub/Sub subscribers setup complete');
    } catch (error) {
      this.logger.error(' Failed to setup Redis subscribers:', error.message);
    }
  }

  //  Handle global bid updates
  private handleGlobalBidUpdate(bidData: any) {
    this.logger.debug(` Global bid update: ${JSON.stringify(bidData)}`);
    // This could trigger cache invalidation or other global actions
  }

  //  Handle auction-specific bid updates
  private handleAuctionBidUpdate(auctionId: string, bidData: any) {
    this.logger.debug(` Auction ${auctionId} bid update: ${JSON.stringify(bidData)}`);
    // This could trigger auction-specific cache updates
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  //  Cache current highest bid with pub/sub notification
  async cacheHighestBid(auctionId: string, bid: any): Promise<void> {
    if (!this.client || !this.publisher) {
      this.logger.warn(' Redis not available for caching highest bid');
      return;
    }

    try {
      // Cache the bid
      await this.client.setEx(`auction:${auctionId}:highest`, 3600, JSON.stringify(bid));
      
      //  Publish cache invalidation event
      await this.publishCacheInvalidation(auctionId, bid);
      
      this.logger.debug(` Cached highest bid for auction ${auctionId}: $${bid.amount}`);
    } catch (error) {
      this.logger.error(' Failed to cache highest bid:', error.message);
    }
  }

  async getHighestBid(auctionId: string): Promise<any> {
    if (!this.client) {
      this.logger.warn(' Redis not available for getting highest bid');
      return null;
    }

    try {
      const cached = await this.client.get(`auction:${auctionId}:highest`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(' Failed to get highest bid:', error.message);
      return null;
    }
  }

  //  Publish cache invalidation event
  async publishCacheInvalidation(auctionId: string, bidData: any): Promise<void> {
    if (!this.publisher) {
      this.logger.warn(' Redis publisher not available');
      return;
    }

    try {
      // Publish to auction-specific channel
      await this.publisher.publish(`auction:${auctionId}:cache:invalidate`, JSON.stringify({
        action: 'CACHE_INVALIDATE',
        auctionId,
        bidData,
        timestamp: new Date().toISOString()
      }));

      // Publish to global bid events
      await this.publisher.publish('bid:global', JSON.stringify({
        action: 'NEW_HIGHEST_BID',
        auctionId,
        amount: bidData.amount,
        userId: bidData.userId,
        timestamp: new Date().toISOString()
      }));

      this.logger.debug(` Published cache invalidation for auction ${auctionId}`);
    } catch (error) {
      this.logger.error(' Failed to publish cache invalidation:', error.message);
    }
  }

  //  Persistent bid history in Redis
  async addToBidHistory(auctionId: string, bidData: any): Promise<void> {
    if (!this.client) {
      this.logger.warn(' Redis not available for bid history');
      return;
    }

    try {
      const key = `auction:${auctionId}:history`;
      await this.client.lPush(key, JSON.stringify(bidData));
      await this.client.lTrim(key, 0, 49); // Keep last 50 bids
      await this.client.expire(key, 86400 * 7); // 7 days expiry
      
      this.logger.debug(` Added bid to history for auction ${auctionId}`);
    } catch (error) {
      this.logger.error(' Failed to add to bid history:', error.message);
    }
  }

  async getBidHistory(auctionId: string): Promise<any[]> {
    if (!this.client) {
      this.logger.warn(' Redis not available for bid history');
      return [];
    }

    try {
      const key = `auction:${auctionId}:history`;
      const history = await this.client.lRange(key, 0, -1);
      return history.map(item => JSON.parse(item));
    } catch (error) {
      this.logger.error(' Failed to get bid history:', error.message);
      return [];
    }
  }

  //  User session with bid tracking
  async setUserSession(userId: string, data: any): Promise<void> {
    if (!this.client) {
      this.logger.warn(' Redis not available for user session');
      return;
    }

    try {
      await this.client.setEx(`session:${userId}`, 7200, JSON.stringify({
        ...data,
        lastActivity: new Date().toISOString()
      }));
      
      this.logger.debug(` Set session for user ${userId}`);
    } catch (error) {
      this.logger.error(' Failed to set user session:', error.message);
    }
  }

  async getUserSession(userId: string): Promise<any> {
    if (!this.client) {
      this.logger.warn(' Redis not available for user session');
      return null;
    }

    try {
      const session = await this.client.get(`session:${userId}`);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      this.logger.error(' Failed to get user session:', error.message);
      return null;
    }
  }

  //  DDoS protection with progressive penalties
  async checkRateLimit(identifier: string, limit: number = 10, window: number = 60): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(' Redis not available for rate limiting');
      return true; // Allow if Redis is down
    }

    try {
      const key = `rate_limit:${identifier}`;
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, window);
      }
      
      // Progressive penalties for heavy abuse
      if (current > limit * 2) {
        await this.client.expire(key, window * 5); // 5x longer penalty
        this.logger.warn(` Heavy abuse detected for ${identifier}: ${current} requests`);
      }
      
      return current <= limit;
    } catch (error) {
      this.logger.error(' Failed to check rate limit:', error.message);
      return true; // Allow if Redis operation fails
    }
  }

  //  Pub/Sub for real-time updates with cross-server support
  async publishBidUpdate(auctionId: string, bidData: any): Promise<void> {
    if (!this.publisher) {
      this.logger.warn(' Redis publisher not available');
      return;
    }

    try {
      // Publish to auction-specific channel
      await this.publisher.publish(`auction:${auctionId}:bids`, JSON.stringify(bidData));
      
      // Publish to global channel for cross-server synchronization
      await this.publisher.publish('bids:all', JSON.stringify({
        auctionId,
        ...bidData
      }));
      
      this.logger.debug(` Published bid update for auction ${auctionId}`);
    } catch (error) {
      this.logger.error(' Failed to publish bid update:', error.message);
    }
  }

  // Subscribe to auction-specific bid updates
  async subscribeToBidUpdates(auctionId: string, callback: (data: any) => void): Promise<void> {
    if (!this.subscriber) {
      this.logger.warn(' Redis subscriber not available');
      return;
    }

    try {
      await this.subscriber.subscribe(`auction:${auctionId}:bids`, (message) => {
        try {
          callback(JSON.parse(message));
        } catch (error) {
          this.logger.error(' Error parsing bid update message:', error.message);
        }
      });
      
      this.logger.log(` Subscribed to bid updates for auction ${auctionId}`);
    } catch (error) {
      this.logger.error(' Failed to subscribe to bid updates:', error.message);
    }
  }

  //  Subscribe to global bid updates for cross-server sync
  async subscribeToGlobalBids(callback: (data: any) => void): Promise<void> {
    if (!this.subscriber) {
      this.logger.warn(' Redis subscriber not available');
      return;
    }

    try {
      await this.subscriber.subscribe('bids:all', (message) => {
        try {
          callback(JSON.parse(message));
        } catch (error) {
          this.logger.error(' Error parsing global bid message:', error.message);
        }
      });
      
      this.logger.log(' Subscribed to global bid updates');
    } catch (error) {
      this.logger.error(' Failed to subscribe to global bids:', error.message);
    }
  }

  //  Health check with detailed status
  isHealthy(): { healthy: boolean; details: any } {
    const status = {
      client: this.client?.isReady || false,
      publisher: this.publisher?.isReady || false,
      subscriber: this.subscriber?.isReady || false
    };

    return {
      healthy: Object.values(status).every(Boolean),
      details: status
    };
  }

  //  Graceful shutdown
  async onModuleDestroy() {
    try {
      const closePromises = [];
      
      if (this.subscriber?.isReady) {
        await this.subscriber.unsubscribe();
        closePromises.push(this.subscriber.quit());
      }
      
      if (this.publisher?.isReady) {
        closePromises.push(this.publisher.quit());
      }
      
      if (this.client?.isReady) {
        closePromises.push(this.client.quit());
      }

      await Promise.all(closePromises);
      this.logger.log(' Redis connections closed gracefully');
    } catch (error) {
      this.logger.error('Error during Redis cleanup:', error.message);
    }
  }
}