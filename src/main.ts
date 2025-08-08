import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import 'reflect-metadata';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  await app.listen(3000);
  console.log(' Car Auction System started on http://localhost:3000');
  console.log(' WebSocket: ws://localhost:3000/auction');
  console.log(' Register at: POST /auth/register');
  console.log(' Login at: POST /auth/login');
}

bootstrap();