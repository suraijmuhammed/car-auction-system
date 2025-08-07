import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('auctions')
export class AuctionController {
  constructor(private auctionService: AuctionService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createAuction(@Body() auctionData: any, @Request() req: any) {
    // Add validation
    if (!auctionData.carId || !auctionData.startingBid) {
      throw new Error('Car ID and starting bid are required');
    }

    const startTime = new Date(auctionData.startTime || Date.now());
    const endTime = new Date(auctionData.endTime || (Date.now() + 24 * 60 * 60 * 1000));

    return this.auctionService.createAuction({
      carId: auctionData.carId,
      startTime,
      endTime,
      startingBid: parseFloat(auctionData.startingBid),
    });
  }

  @Get()
  async getActiveAuctions() {
    return this.auctionService.getActiveAuctions();
  }

  @Get(':id')
  async getAuction(@Param('id') id: string) {
    return this.auctionService.getAuction(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/end')
  async endAuction(@Param('id') id: string) {
    return this.auctionService.endAuction(id);
  }
}