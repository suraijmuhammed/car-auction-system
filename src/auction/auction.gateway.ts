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
  private auctionRooms = new Map<string, Set<string>>();

  constructor(
    private bidService: BidService,
    private redis: RedisService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || 
                   client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.user = {
        id: payload.sub,
        username: payload.username,
        email: payload.email,
      };

      this.connectedUsers.set(client.user.id, client);
      
      // ✅ Enhanced: Store user session with socket info
      await this.redis.setUserSession(client.user.id, {
        socketId: client.id,
        connectedAt: new Date(),
        username: client.user.username
      });

      console.log(`👤 User connected: ${client.user.username} (${client.id})`);
      client.emit('connected', { 
        message: `Welcome back, ${client.user.username}!`,
        user: client.user 
      });

    } catch (error) {
      console.error('Authentication failed:', error.message);
      client.emit('error', { message: 'Invalid authentication token' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.connectedUsers.delete(client.user.id);
      
      // Remove from auction rooms
      this.auctionRooms.forEach((users, auctionId) => {
        users.delete(client.user.id);
        if (users.size === 0) {
          this.auctionRooms.delete(auctionId);
        }
      });
      
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
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    // Join auction room
    await client.join(`auction-${auctionId}`);
    
    // Track users in auction room
    if (!this.auctionRooms.has(auctionId)) {
      this.auctionRooms.set(auctionId, new Set());
    }
    this.auctionRooms.get(auctionId).add(client.user.id);

    
    const [highestBid, bidHistory, auctionStats] = await Promise.all([
      this.redis.getHighestBid(auctionId),
      this.bidService.getAuctionBids(auctionId),
      this.bidService.getAuctionStats(auctionId)
    ]);

    client.emit('joinedAuction', { 
      auctionId,
      message: `Joined auction ${auctionId}`,
      userCount: this.auctionRooms.get(auctionId).size,
      stats: auctionStats
    });

    if (highestBid) {
      client.emit('currentHighestBid', highestBid);
    }

    
    client.emit('bidHistory', bidHistory);

    console.log(`🏛️ ${client.user.username} joined auction ${auctionId} (${this.auctionRooms.get(auctionId).size} users)`);
  }

  @SubscribeMessage('placeBid')
  async handlePlaceBid(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { auctionId: string; amount: number | string },
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    
    const rateLimitKey = `bid:${client.user.id}:${data.auctionId}`;
    if (!await this.redis.checkRateLimit(rateLimitKey, 5, 30)) {
      client.emit('bidError', { 
        message: 'Too many bid attempts. Please wait 30 seconds before trying again.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
      return;
    }

    try {
   
      const amount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;
      
      
      if (isNaN(amount) || amount <= 0) {
        client.emit('bidError', { 
          message: 'Please enter a valid bid amount',
          code: 'INVALID_AMOUNT'
        });
        return;
      }

      const bidData = {
        auctionId: data.auctionId,
        userId: client.user.id,
        amount: amount, // Use converted number
      };

      const bid = await this.bidService.placeBid(bidData);
      
      // ✅ Enhanced: Broadcast with user count and stats
      const userCount = this.auctionRooms.get(data.auctionId)?.size || 0;
      
      this.server.to(`auction-${data.auctionId}`).emit('newBid', {
        bidId: bid.id,
        amount: bid.amount,
        userId: bid.userId,
        username: bid.user.username,
        fullName: bid.user.fullName,
        timestamp: bid.timestamp,
        userCount,
      });

      client.emit('bidPlaced', { 
        success: true, 
        bidId: bid.id,
        message: `Bid of $${bid.amount.toLocaleString()} placed successfully!`
      });

    } catch (error) {
      console.error('Bid error:', error.message);
      client.emit('bidError', { 
        message: error.message,
        code: 'BID_VALIDATION_ERROR'
      });
    }
  }

  @SubscribeMessage('getBidHistory')
  async handleGetBidHistory(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { auctionId: string },
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    try {
      const bidHistory = await this.bidService.getAuctionBids(data.auctionId);
      client.emit('bidHistory', bidHistory);
    } catch (error) {
      client.emit('error', { message: 'Failed to load bid history' });
    }
  }

  @SubscribeMessage('auctionEnd')
  async handleAuctionEnd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { auctionId: string; winnerId: string; winningBid: number },
  ) {
    this.server.to(`auction-${data.auctionId}`).emit('auctionEnded', {
      auctionId: data.auctionId,
      winnerId: data.winnerId,
      winningBid: data.winningBid,
      message: '🏆 Auction completed!',
    });
  }
}