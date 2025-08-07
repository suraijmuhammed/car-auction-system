import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { BidService } from '../bid/bid.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/auction',
})
@Injectable()
export class AuctionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, AuthenticatedSocket>();
  private rateLimiter = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private bidService: BidService,
    private redis: RedisService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT token from handshake
      const token = client.handshake.auth.token || 
                   client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      client.user = {
        id: payload.sub,
        username: payload.username,
        email: payload.email,
      };

      this.connectedUsers.set(client.user.id, client);
      await this.redis.setUserSession(client.user.id, client.id);

      console.log(`👤 User connected: ${client.user.username} (${client.id})`);
      client.emit('connected', { 
        message: `Welcome ${client.user.username}!`,
        user: client.user 
      });

    } catch (error) {
      console.error('Authentication failed:', error.message);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.connectedUsers.delete(client.user.id);
      console.log(`👋 User disconnected: ${client.user.username}`);
    }
  }

  @SubscribeMessage('joinAuction')
  async handleJoinAuction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { auctionId: string },
  ) {
    const { auctionId } = data;
    
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Join auction room
    await client.join(`auction-${auctionId}`);
    
    // Send current highest bid
    const highestBid = await this.redis.getHighestBid(auctionId);
    if (highestBid) {
      client.emit('currentHighestBid', highestBid);
    }

    client.emit('joinedAuction', { 
      auctionId, 
      message: `Joined auction ${auctionId}`,
      user: client.user.username
    });

    console.log(`🏛️ ${client.user.username} joined auction ${auctionId}`);
  }

  @SubscribeMessage('placeBid')
  async handlePlaceBid(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { auctionId: string; amount: number },
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Rate limiting check
    if (!this.checkRateLimit(client.id)) {
      client.emit('bidError', { message: 'Too many requests. Please wait before placing another bid.' });
      return;
    }

    try {
      const bidData = {
        ...data,
        userId: client.user.id, // Use authenticated user ID
      };

      const bid = await this.bidService.placeBid(bidData);
      
      // Broadcast to all clients in the auction room
      this.server.to(`auction-${data.auctionId}`).emit('newBid', {
        bidId: bid.id,
        amount: bid.amount,
        userId: bid.userId,
        username: bid.user.username,
        timestamp: bid.timestamp,
      });

      client.emit('bidPlaced', { 
        success: true, 
        bidId: bid.id,
        message: `Bid of $${bid.amount} placed successfully!`
      });

    } catch (error) {
      console.error('Bid error:', error.message);
      client.emit('bidError', { message: error.message });
    }
  }

  @SubscribeMessage('auctionEnd')
  async handleAuctionEnd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { auctionId: string; winnerId: string; winningBid: number },
  ) {
    // Notify all clients in the auction room
    this.server.to(`auction-${data.auctionId}`).emit('auctionEnded', {
      auctionId: data.auctionId,
      winnerId: data.winnerId,
      winningBid: data.winningBid,
      message: '🎉 Auction has ended!',
    });
  }

  // Rate limiting for DDoS protection
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimiter.get(clientId);

    if (!limit || now > limit.resetTime) {
      this.rateLimiter.set(clientId, { count: 1, resetTime: now + 60000 }); // 1 minute window
      return true;
    }

    if (limit.count >= 10) { // 10 requests per minute
      return false;
    }

    limit.count++;
    return true;
  }
}