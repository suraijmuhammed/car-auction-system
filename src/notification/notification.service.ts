import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { AuctionGateway } from '../auction/auction.gateway';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private rabbitmq: RabbitmqService,
    private auctionGateway: AuctionGateway,
  ) {}

  async onModuleInit() {
    // Start consuming notifications from RabbitMQ
    await this.rabbitmq.consumeNotifications(this.handleNotification.bind(this));
    this.logger.log(' Notification service started - listening for RabbitMQ messages');
  }

  // Handle incoming notifications from RabbitMQ
  private async handleNotification(notification: any) {
    this.logger.log(` Processing notification: ${JSON.stringify(notification)}`);

    try {
      switch (notification.type) {
        case 'AUCTION_WON':
          await this.sendWinnerNotification(notification);
          break;
          
        case 'AUCTION_LOST':
          await this.sendLoserNotification(notification);
          break;
          
        case 'AUCTION_ENDED_NO_BIDS':
          await this.sendNoBidsNotification(notification);
          break;
          
        default:
          this.logger.warn(` Unknown notification type: ${notification.type}`);
      }
    } catch (error) {
      this.logger.error(` Error processing notification: ${error.message}`);
    }
  }

  // Send winner notification
  private async sendWinnerNotification(notification: any) {
    const { userId, auctionId, message, carDetails, winningBid } = notification;
    
    // Send to specific user via WebSocket
    if (this.auctionGateway.server) {
      this.auctionGateway.server.emit('userNotification', {
        userId,
        type: 'success',
        title: 'Congratulations!',
        message,
        data: {
          auctionId,
          carDetails,
          winningBid
        }
      });
    }
    
    this.logger.log(` Winner notification sent to user ${userId}`);
  }

  // Send loser notification  
  private async sendLoserNotification(notification: any) {
    const { userId, auctionId, message, carDetails, winningBid, winner } = notification;
    
    // Send to specific user via WebSocket
    if (this.auctionGateway.server) {
      this.auctionGateway.server.emit('userNotification', {
        userId,
        type: 'info',
        title: ' Auction Ended',
        message,
        data: {
          auctionId,
          carDetails,
          winningBid,
          winner
        }
      });
    }
    
    this.logger.log(` Loser notification sent to user ${userId}`);
  }

  // Send no bids notification
  private async sendNoBidsNotification(notification: any) {
    const { auctionId, message, carDetails, startingBid } = notification;
    
    // Broadcast to all users in auction room
    if (this.auctionGateway.server) {
      this.auctionGateway.server.to(`auction-${auctionId}`).emit('auctionNotification', {
        type: 'info',
        title: ' Auction Ended',
        message,
        data: {
          auctionId,
          carDetails,
          startingBid
        }
      });
    }
    
    this.logger.log(` No bids notification sent for auction ${auctionId}`);
  }
}