const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data in order
  await prisma.report.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.vehicleFeature.deleteMany({});
  await prisma.vehicleImage.deleteMany({});
  await prisma.vehicleDocument.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.sellerProfile.deleteMany({});
  await prisma.user.deleteMany({});

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'admin@carmarket.com',
      password: hashedPassword,
      name: 'System Admin',
      phone: '+233201234567',
      role: 'ADMIN',
      verified: true,
    },
  });
  console.log('✅ Admin user created: admin@carmarket.com');

  // 2. Create Seller User 1 (Dealer)
  const sellerUser1 = await prisma.user.create({
    data: {
      email: 'kwame.dealer@carmarket.com',
      password: hashedPassword,
      name: 'Kwame Mensah (Ghana Motors)',
      phone: '+233244112233',
      role: 'SELLER',
      verified: true,
    },
  });
  const seller1 = await prisma.sellerProfile.create({
    data: {
      userId: sellerUser1.id,
      whatsapp: '+233244112233',
      location: 'Airport Residential Area, Accra',
      verified: true,
      sellerType: 'DEALER',
      rating: 4.8,
    },
  });
  console.log('✅ Seller 1 created: kwame.dealer@carmarket.com');

  // 3. Create Seller User 2 (Private)
  const sellerUser2 = await prisma.user.create({
    data: {
      email: 'kofi.private@carmarket.com',
      password: hashedPassword,
      name: 'Kofi Owusu',
      phone: '+233509876543',
      role: 'SELLER',
      verified: true,
    },
  });
  const seller2 = await prisma.sellerProfile.create({
    data: {
      userId: sellerUser2.id,
      whatsapp: '+233509876543',
      location: 'Adum, Kumasi',
      verified: true,
      sellerType: 'PRIVATE',
      rating: 4.5,
    },
  });
  console.log('✅ Seller 2 created: kofi.private@carmarket.com');

  // 4. Create Buyer User
  const buyerUser = await prisma.user.create({
    data: {
      email: 'abena.buyer@carmarket.com',
      password: hashedPassword,
      name: 'Abena Appiah',
      phone: '+233277665544',
      role: 'BUYER',
      verified: true,
    },
  });
  console.log('✅ Buyer created: abena.buyer@carmarket.com');

  // SVG Data URI fallback for images
  const sampleCarSvg = (make, model, color) => 
    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="%230f172a"/><rect x="100" y="220" width="600" height="140" rx="30" fill="${encodeURIComponent(color)}"/><path d="M220 220 L320 120 L500 120 L600 220 Z" fill="${encodeURIComponent(color)}" opacity="0.85"/><circle cx="240" cy="360" r="50" fill="%231e293b" stroke="%23cbd5e1" stroke-width="8"/><circle cx="560" cy="360" r="50" fill="%231e293b" stroke="%23cbd5e1" stroke-width="8"/><text x="400" y="80" fill="%23ffffff" font-family="sans-serif" font-size="32" font-weight="bold" text-anchor="middle">${make} ${model}</text></svg>`;

  // 5. Vehicles Data
  const vehiclesData = [
    {
      sellerId: seller1.id,
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      price: 185000,
      location: 'Accra',
      condition: 'FOREIGN_USED',
      mileage: 34500,
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      engineSize: '2.5L 4-Cylinder',
      bodyType: 'Sedan',
      color: 'Midnight Blue',
      description: 'Extremely clean foreign used 2021 Toyota Camry SE. Features leather seats, sunroof, reverse camera, Apple CarPlay, and lane departure alert. Fully serviced with complete customs duty paid.',
      status: 'AVAILABLE',
      featured: true,
      colorHex: '#1e3a8a',
      features: ['Sunroof', 'Leather Seats', 'Reverse Camera', 'Apple CarPlay', 'Keyless Entry', 'Bluetooth'],
    },
    {
      sellerId: seller1.id,
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      price: 145000,
      location: 'Accra',
      condition: 'FOREIGN_USED',
      mileage: 42000,
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      engineSize: '1.5L Turbo',
      bodyType: 'Sedan',
      color: 'Sonic Gray',
      description: 'Sleek 2020 Honda Civic Touring Turbo. Excellent fuel economy, sporty design, heated seats, and premium audio system. Ready for immediate pickup in Accra.',
      status: 'AVAILABLE',
      featured: true,
      colorHex: '#475569',
      features: ['Turbocharger', 'Heated Seats', 'Navigation', 'Alloy Wheels', 'Blind Spot Monitor'],
    },
    {
      sellerId: seller1.id,
      make: 'Mercedes',
      model: 'C-Class',
      year: 2019,
      price: 260000,
      location: 'Accra',
      condition: 'FOREIGN_USED',
      mileage: 51000,
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      engineSize: '2.0L Turbo',
      bodyType: 'Sedan',
      color: 'Obsidian Black',
      description: 'Luxury 2019 Mercedes-Benz C300 AMG Line. Panoramic glass roof, Burmester surround sound, ambient lighting, and AMG wheels. Accident-free.',
      status: 'AVAILABLE',
      featured: true,
      colorHex: '#0f172a',
      features: ['Panoramic Roof', 'Burmester Audio', 'Ambient Lighting', 'AMG Package', 'Leather Seats'],
    },
    {
      sellerId: seller2.id,
      make: 'Hyundai',
      model: 'Elantra',
      year: 2022,
      price: 165000,
      location: 'Kumasi',
      condition: 'BRAND_NEW',
      mileage: 8500,
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      engineSize: '2.0L',
      bodyType: 'Sedan',
      color: 'Polar White',
      description: 'Almost brand new 2022 Hyundai Elantra SEL. Low mileage, digital dashboard, wireless charging, and full manufacturer warranty remaining.',
      status: 'AVAILABLE',
      featured: false,
      colorHex: '#f8fafc',
      features: ['Digital Cluster', 'Wireless Charging', 'Push Button Start', 'Lane Assist'],
    },
    {
      sellerId: seller2.id,
      make: 'BMW',
      model: '3 Series',
      year: 2020,
      price: 295000,
      location: 'Kumasi',
      condition: 'FOREIGN_USED',
      mileage: 38000,
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      engineSize: '2.0L TwinPower Turbo',
      bodyType: 'Sedan',
      color: 'Sunset Orange',
      description: 'Stunning 2020 BMW 330i M Sport. Heads-up display, M aerodynamic package, live cockpit professional, and gesture control.',
      status: 'AVAILABLE',
      featured: true,
      colorHex: '#ea580c',
      features: ['Heads-Up Display', 'M Sport Package', 'Gesture Control', 'Live Cockpit'],
    },
    {
      sellerId: seller1.id,
      make: 'Nissan',
      model: 'Rogue',
      year: 2021,
      price: 198000,
      location: 'Takoradi',
      condition: 'FOREIGN_USED',
      mileage: 49000,
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      engineSize: '2.5L 4-Cylinder',
      bodyType: 'SUV',
      color: 'Gun Metallic',
      description: 'Family friendly 2021 Nissan Rogue SV AWD. Spacious interior, ProPILOT assist, motion-activated liftgate, and panoramic roof.',
      status: 'PENDING',
      featured: false,
      colorHex: '#52525b',
      features: ['AWD', 'ProPILOT Assist', 'Power Tailgate', 'Panoramic Roof'],
    },
  ];

  const createdVehicles = [];

  for (const item of vehiclesData) {
    const { features, colorHex, ...vData } = item;
    const vehicle = await prisma.vehicle.create({
      data: {
        ...vData,
        images: {
          create: [
            {
              data: sampleCarSvg(vData.make, vData.model, colorHex),
              isPrimary: true,
            },
          ],
        },
        features: {
          create: features.map(f => ({ featureName: f })),
        },
      },
    });
    createdVehicles.push(vehicle);
    console.log(`🚗 Vehicle created: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.status})`);
  }

  // 6. Seed Favorites
  await prisma.favorite.create({
    data: {
      userId: buyerUser.id,
      vehicleId: createdVehicles[0].id,
    },
  });
  await prisma.favorite.create({
    data: {
      userId: buyerUser.id,
      vehicleId: createdVehicles[2].id,
    },
  });
  console.log('❤️ Favorites created for buyer');

  // 7. Seed Reports
  await prisma.report.create({
    data: {
      reporterId: buyerUser.id,
      vehicleId: createdVehicles[3].id,
      reason: 'Inquired about the car, but seller asked for a advance deposit before inspection. Please review.',
      status: 'PENDING',
    },
  });
  console.log('⚠️ Sample report created');

  // 8. Seed Messages
  await prisma.message.create({
    data: {
      senderId: buyerUser.id,
      receiverId: sellerUser1.id,
      vehicleId: createdVehicles[0].id,
      content: 'Hello Kwame! I am interested in the 2021 Toyota Camry. Is it available for inspection tomorrow in Accra?',
    },
  });
  await prisma.message.create({
    data: {
      senderId: sellerUser1.id,
      receiverId: buyerUser.id,
      vehicleId: createdVehicles[0].id,
      content: 'Hello Abena! Yes it is available. You can visit our showroom at Airport Residential Area anytime after 10 AM.',
    },
  });
  console.log('💬 Sample messages created');

  console.log('\n🎉 Database Seeding Complete!');
  console.log('\n🔑 Demo Credentials:');
  console.log('   Admin:  admin@carmarket.com      / Password123!');
  console.log('   Seller: kwame.dealer@carmarket.com / Password123!');
  console.log('   Buyer:  abena.buyer@carmarket.com  / Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
