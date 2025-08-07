import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() userData: any) {
    // Basic validation
    if (!userData.username || userData.username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }
    if (!userData.email || !userData.email.includes('@')) {
      throw new Error('Please provide a valid email address');
    }
    if (!userData.password || userData.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    return this.authService.register(userData);
  }

  @Post('login')
  async login(@Body() loginData: any) {
    if (!loginData.email || !loginData.password) {
      throw new Error('Email and password are required');
    }
    
    return this.authService.login(loginData.email, loginData.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return {
      user: req.user,
      message: 'Profile retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  verifyToken(@Request() req: any) {
    return {
      valid: true,
      user: req.user,
      message: 'Token is valid',
    };
  }
}