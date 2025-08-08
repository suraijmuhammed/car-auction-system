const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with enhanced auction data...');

  // Clear existing data first
  console.log('🧹 Cleaning existing data...');
  await prisma.bid.deleteMany({});
  await prisma.auction.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ Existing data cleared');

  // Create sample users
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

  // Create enhanced auctions with car details
  console.log('🏛️ Creating enhanced auctions...');
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
        currentHighestBid: 250000, // ✅ Fixed: Same as starting bid
        status: 'ACTIVE',
        carMake: 'Ferrari',
        carModel: 'F8 Tributo',
        carYear: 2023,
        carImages: [
          'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80',
          'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80',
          'https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=800&q=80'
        ],
        carDescription: 'The Ferrari F8 Tributo is a mid-engine sports car with a 710HP V8 twin-turbo engine. This pristine 2023 model features carbon fiber accents and represents the pinnacle of Italian engineering.',
      },
    }),
    prisma.auction.create({
      data: {
        id: 'lamborghini-special',
        carId: 'lamborghini-huracan-evo-2023',
        startTime: now,
        endTime: tomorrow,
        startingBid: 200000,
        currentHighestBid: 200000,
        status: 'ACTIVE',
        carMake: 'Lamborghini',
        carModel: 'Huracán EVO',
        carYear: 2023,
        carImages: [
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
          'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80',
          'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80'
        ],
        carDescription: 'The Lamborghini Huracán EVO features a naturally aspirated V10 engine producing 630HP. This 2023 model showcases Lamborghini\'s signature aggressive styling and superior performance.',
      },
    }),
    prisma.auction.create({
      data: {
        id: 'porsche-gt3-rare',
        carId: 'porsche-911-gt3-rs-2023',
        startTime: now,
        endTime: tomorrow,
        startingBid: 180000,
        currentHighestBid: 180000,
        status: 'ACTIVE',
        carMake: 'Porsche',
        carModel: '911 GT3 RS',
        carYear: 2023,
        carImages: [
          'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',
          'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80',
          'https://images.unsplash.com/photo-1544829099-b9a0c5303bea?w=800&q=80'
        ],
        carDescription: 'The Porsche 911 GT3 RS is a track-focused variant with a 518HP flat-six engine. This 2023 model features advanced aerodynamics and is street legal while being optimized for track performance.',
      },
    }),
  ]);

  console.log('✅ Created 3 enhanced auctions with car details and images');

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📋 Enhanced Sample Data:');
  console.log(`Users: ${users.length} (password: password123)`);
  console.log(`Auctions: ${auctions.length} with car images and details`);
  
  console.log('\n🏛️ Auction Details:');
  auctions.forEach(auction => {
    console.log(`- ${auction.carMake} ${auction.carModel} ${auction.carYear}: ${auction.startingBid.toLocaleString()}`);
    console.log(`  Images: ${auction.carImages.length} photos`);
  });
  
  console.log('\n🧪 Test Credentials:');
  console.log('- john@example.com / password123');
  console.log('- sarah@example.com / password123'); 
  console.log('- mike@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });