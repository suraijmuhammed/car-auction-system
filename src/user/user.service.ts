import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }) {
    const user = await this.prisma.user.create({
      data: userData,
    });
    console.log(`👤 New user created: ${user.username} (${user.email})`);
    return user;
  }

  async findById(id: string) {
    return await this.prisma.user.findUnique({
      where: { id },
      include: {
        bids: {
          include: { auction: true },
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string) {
    return await this.prisma.user.findUnique({
      where: { username },
    });
  }

  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        bids: { include: { auction: true } },
      },
    });

    if (!user) return null;

    const totalBids = user.bids.length;
    const totalSpent = user.bids.reduce((sum, bid) => sum + bid.amount, 0);
    const uniqueAuctions = new Set(user.bids.map(bid => bid.auctionId)).size;

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt,
      },
      stats: {
        totalBids,
        totalSpent,
        uniqueAuctions,
        averageBid: totalBids > 0 ? totalSpent / totalBids : 0,
      },
    };
  }
} 