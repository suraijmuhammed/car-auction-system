import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async register(userData: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }) {
    const { username, email, password, fullName } = userData;

    // Check if user already exists
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const existingUsername = await this.userService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await this.userService.createUser({
      username,
      email,
      password: hashedPassword,
      fullName,
    });

    // Generate JWT token
    const payload = { 
      sub: user.id, 
      username: user.username, 
      email: user.email 
    };
    
    const token = this.jwtService.sign(payload);

    // Return user without password
    const { password: _, ...userResponse } = user;
    
    return {
      user: userResponse,
      access_token: token,
      message: '🎉 Registration successful! Welcome to the auction system!',
    };
  }

  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { 
      sub: user.id, 
      username: user.username, 
      email: user.email 
    };
    
    const token = this.jwtService.sign(payload);
    const { password: _, ...userResponse } = user;

    return {
      user: userResponse,
      access_token: token,
      message: '✅ Login successful!',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
}