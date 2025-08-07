import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class RabbitmqService implements OnModuleInit {
  private connection: any;
  private channel: any;

  async onModuleInit() {
    try {
      const amqp = require('amqplib');
      this.connection = await amqp.connect('amqp://auction:auction123@localhost:5672');
      this.channel = await this.connection.createChannel();
      
      await this.setupQueues();
      console.log('🐰 Connected to RabbitMQ');
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      console.log('💡 Make sure RabbitMQ is running: docker-compose up -d');
    }
  }

  private async setupQueues(): Promise<void> {
    // Setup queues
    await this.channel.assertQueue('bid-processing', { durable: true });
    await this.channel.assertQueue('notifications', { durable: true });
    await this.channel.assertQueue('audit-logs', { durable: true });
    await this.channel.assertQueue('dead-letter', { durable: true });
    
    // Setup exchanges
    await this.channel.assertExchange('auction-events', 'direct', { durable: true });
  }

  async publishBidEvent(bidData: any): Promise<void> {
    if (!this.channel) {
      console.error('RabbitMQ channel not available');
      return;
    }
    
    const message = Buffer.from(JSON.stringify(bidData));
    await this.channel.sendToQueue('bid-processing', message, { persistent: true });
  }

  async publishNotification(notification: any): Promise<void> {
    if (!this.channel) {
      console.error('RabbitMQ channel not available');
      return;
    }
    
    const message = Buffer.from(JSON.stringify(notification));
    await this.channel.sendToQueue('notifications', message, { persistent: true });
  }

  async publishAuditLog(auditData: any): Promise<void> {
    if (!this.channel) {
      console.error('RabbitMQ channel not available');
      return;
    }
    
    const message = Buffer.from(JSON.stringify(auditData));
    await this.channel.sendToQueue('audit-logs', message, { persistent: true });
  }

  async consumeBidProcessing(callback: (data: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      console.error('RabbitMQ channel not available');
      return;
    }
    
    await this.channel.consume('bid-processing', async (msg: any) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          await callback(data);
          this.channel.ack(msg);
        } catch (error) {
          console.error('Error processing bid:', error);
          this.channel.nack(msg, false, false);
        }
      }
    });
  }
}