# Royal Class Car Auction System

## Overview
Enterprise-grade real-time car auction platform built with NestJS, React, and WebSockets.

##  Architecture
- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL + Prisma ORM  
- **Cache**: Redis (Pub/Sub + Session Management)
- **Message Queue**: RabbitMQ
- **Frontend**: React + TypeScript + Tailwind
- **Real-time**: WebSocket Gateway

##  PDF Requirements 
- WebSocket Gateway (NestJS + Socket.IO) -Done
-  Database Integration (PostgreSQL + Prisma) -Done
-  Redis Caching & Pub/Sub - Done
-  RabbitMQ Message Queues - Done
-  DDoS Mitigation & Rate Limiting -Done

##  Quick Start

create a .env file and paste the details of .env.example

# Backend
docker-compose up -d ,
npm install ,
npx prisma migrate dev ,
npm run seed ,
npm run start:dev ,

# Frontend  
cd frontend ,
npm install ,
npm start
