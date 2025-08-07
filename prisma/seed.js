const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with real users and auctions...');

  // Clear existing data first (in correct order due to foreign keys)
  console.log('🧹 Cleaning existing data...');
  await prisma.bid.deleteMany({});
  await prisma.auction.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ Existing data cleared');

  // Create sample users with hashed passwords
  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 12);
  
  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'john_collector',
        email: 'john@example.com',
        password: hashedPassword,
        fullName: 'John Smith',
      },
    }),
    prisma.user.create({
      data: {
        username: 'sarah_bidder',
        email: 'sarah@example.com', 
        password: hashedPassword,
        fullName: 'Sarah Johnson',
      },
    }),
    prisma.user.create({
      data: {
        username: 'mike_enthusiast',
        email: 'mike@example.com',
        password: hashedPassword,
        fullName: 'Mike Wilson',
      },
    }),
  ]);

  console.log('✅ Created 3 sample users (password: password123)');

  // Create sample auctions
  console.log('🏛️ Creating auctions...');
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const auctions = await Promise.all([
    prisma.auction.create({
      data: {
        id: 'luxury-ferrari-2023',
        carId: 'ferrari-f8-tributo-2023',
        startTime: now,
        endTime: tomorrow,
        startingBid: 250000,
        currentHighestBid: 0,
        status: 'ACTIVE',
      },
    }),
    prisma.auction.create({
      data: {
        id: 'lamborghini-special',
        carId: 'lamborghini-huracan-evo-2023',
        startTime: now,
        endTime: tomorrow,
        startingBid: 200000,
        currentHighestBid: 0,
        status: 'ACTIVE',
      },
    }),
    prisma.auction.create({
      data: {
        id: 'porsche-gt3-rare',
        carId: 'porsche-911-gt3-rs-2023',
        startTime: now,
        endTime: tomorrow,
        startingBid: 180000,
        currentHighestBid: 0,
        status: 'ACTIVE',
      },
    }),
  ]);

  console.log('✅ Created 3 sample auctions');

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📋 Sample Data Summary:');
  console.log(`Users: ${users.length} (all with password: password123)`);
  console.log(`Auctions: ${auctions.length} active auctions`);
  
  console.log('\n🧪 Test Login Credentials:');
  console.log('- john@example.com / password123');
  console.log('- sarah@example.com / password123'); 
  console.log('- mike@example.com / password123');
  
  console.log('\n🚀 API Endpoints:');
  console.log('- Register: POST http://localhost:3000/auth/register');
  console.log('- Login: POST http://localhost:3000/auth/login');
  console.log('- Auctions: GET http://localhost:3000/auctions');
  console.log('- WebSocket: ws://localhost:3000/auction (with JWT token)');
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Run: npm run start:dev');
  console.log('2. Open: test-client.html in browser');
  console.log('3. Login with sample credentials and start bidding!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    console.log('\n🔧 Try running: npm run db:reset');
    console.log('This will reset your database and migrations.');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });