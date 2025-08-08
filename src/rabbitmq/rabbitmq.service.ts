import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class RabbitmqService implements OnModuleInit {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: any;
  private channel: any;
  private maxRetries = 5;
  private retryDelay = 3000; // 3 seconds

  async onModuleInit() {
    await this.connectWithRetry();
  }

  // Retry connection logic
  private async connectWithRetry(attempt: number = 1): Promise<void> {
    try {
      this.logger.log(`🐰 Connecting to RabbitMQ (attempt ${attempt}/${this.maxRetries})...`);
      
      const amqp = require('amqplib');
      this.connection = await amqp.connect('amqp://auction:auction123@localhost:5672');
      this.channel = await this.connection.createChannel();
      
      // Setup connection error handlers
      this.connection.on('error', (err: Error) => {
        this.logger.error(' RabbitMQ connection error:', err.message);
      });

      this.connection.on('close', () => {
        this.logger.warn(' RabbitMQ connection closed');
      });
      
      await this.setupQueues();
      this.logger.log(' Successfully connected to RabbitMQ');
      
    } catch (error) {
      this.logger.error(` RabbitMQ connection failed (attempt ${attempt}):`, error.message);
      
      if (attempt < this.maxRetries) {
        this.logger.log(`Retrying in ${this.retryDelay/1000} seconds...`);
        await this.delay(this.retryDelay);
        return this.connectWithRetry(attempt + 1);
      } else {
        this.logger.error(' Max retries exceeded. RabbitMQ will be unavailable.');
        this.logger.log(' Make sure RabbitMQ is running: docker-compose up -d');
      }
    }
  }

  // Delay helper
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async setupQueues(): Promise<void> {
    if (!this.channel) {
      this.logger.warn(' No RabbitMQ channel available for queue setup');
      return;
    }

    try {
      // Setup queues
      await this.channel.assertQueue('bid-processing', { durable: true });
      await this.channel.assertQueue('notifications', { durable: true });
      await this.channel.assertQueue('audit-logs', { durable: true });
      await this.channel.assertQueue('dead-letter', { durable: true });
      
      // Setup exchanges
      await this.channel.assertExchange('auction-events', 'direct', { durable: true });
      
      this.logger.log(' RabbitMQ queues and exchanges configured');
    } catch (error) {
      this.logger.error(' Failed to setup RabbitMQ queues:', error.message);
    }
  }

  // Safe publishing with null checks
  async publishBidEvent(bidData: any): Promise<void> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ not available, skipping bid event publication');
      return;
    }
    
    try {
      const message = Buffer.from(JSON.stringify(bidData));
      await this.channel.sendToQueue('bid-processing', message, { persistent: true });
      this.logger.debug(' Bid event published to queue');
    } catch (error) {
      this.logger.error(' Failed to publish bid event:', error.message);
    }
  }

  async publishNotification(notification: any): Promise<void> {
    if (!this.channel) {
      this.logger.warn(' RabbitMQ not available, skipping notification');
      return;
    }
    
    try {
      const message = Buffer.from(JSON.stringify(notification));
      await this.channel.sendToQueue('notifications', message, { persistent: true });
      this.logger.debug(' Notification published to queue');
    } catch (error) {
      this.logger.error(' Failed to publish notification:', error.message);
    }
  }

  async publishAuditLog(auditData: any): Promise<void> {
    if (!this.channel) {
      this.logger.warn(' RabbitMQ not available, skipping audit log');
      return;
    }
    
    try {
      const message = Buffer.from(JSON.stringify(auditData));
      await this.channel.sendToQueue('audit-logs', message, { persistent: true });
      this.logger.debug(' Audit log published to queue');
    } catch (error) {
      this.logger.error(' Failed to publish audit log:', error.message);
    }
  }

  async consumeBidProcessing(callback: (data: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      this.logger.warn(' RabbitMQ not available, cannot setup bid processing consumer');
      return;
    }
    
    try {
      await this.channel.consume('bid-processing', async (msg: any) => {
        if (msg) {
          try {
            const data = JSON.parse(msg.content.toString());
            await callback(data);
            this.channel.ack(msg);
            this.logger.debug(' Bid processing message consumed successfully');
          } catch (error) {
            this.logger.error(' Error processing bid:', error.message);
            this.channel.nack(msg, false, false);
          }
        }
      });
      
      this.logger.log(' Bid processing consumer started');
    } catch (error) {
      this.logger.error(' Failed to setup bid processing consumer:', error.message);
    }
  }

  // NEW: Consume notifications
  async consumeNotifications(callback: (data: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      this.logger.warn(' RabbitMQ not available, cannot setup notification consumer');
      return;
    }
    
    try {
      await this.channel.consume('notifications', async (msg: any) => {
        if (msg) {
          try {
            const data = JSON.parse(msg.content.toString());
            await callback(data);
            this.channel.ack(msg);
            this.logger.debug(' Notification message consumed successfully');
          } catch (error) {
            this.logger.error(' Error processing notification:', error.message);
            this.channel.nack(msg, false, false);
          }
        }
      });
      
      this.logger.log('Notification consumer started');
    } catch (error) {
      this.logger.error(' Failed to setup notification consumer:', error.message);
    }
  }

  // Health check method
  isHealthy(): boolean {
    return this.connection && this.channel && !this.connection.connection.stream.destroyed;
  }

  // Graceful shutdown
  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.logger.log(' RabbitMQ channel closed');
      }
      if (this.connection) {
        await this.connection.close();
        this.logger.log(' RabbitMQ connection closed');
      }
    } catch (error) {
      this.logger.error(' Error during RabbitMQ cleanup:', error.message);
    }
  }
}