// Adds demo car listings to the marketplace using the CURRENT sellers —
// it never creates, modifies or deletes users or seller profiles, and it
// never removes existing listings. Safe to re-run: a listing is skipped
// when its seller already has the same make/model/year.
//
// Usage (run from backend/, uses DATABASE_URL from .env):
//   node scripts/seed-listings.js             # seed
//   node scripts/seed-listings.js --dry-run   # preview only, writes nothing
//
// Listings go straight to AVAILABLE (a few PENDING land in the admin
// approval queue instead). This bypasses plan listing limits on purpose —
// it is an operator tool, not a user flow.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// Same placeholder art as prisma/seed.js: an SVG data URI per car, no
// external file dependency.
const carSvg = (make, model, color) =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="%230f172a"/><rect x="100" y="220" width="600" height="140" rx="30" fill="${encodeURIComponent(color)}"/><path d="M220 220 L320 120 L500 120 L600 220 Z" fill="${encodeURIComponent(color)}" opacity="0.85"/><circle cx="240" cy="360" r="50" fill="%231e293b" stroke="%23cbd5e1" stroke-width="8"/><circle cx="560" cy="360" r="50" fill="%231e293b" stroke="%23cbd5e1" stroke-width="8"/><text x="400" y="80" fill="%23ffffff" font-family="sans-serif" font-size="32" font-weight="bold" text-anchor="middle">${make} ${model}</text></svg>`;

const CATALOG = [
  { make: 'Toyota', model: 'Corolla', year: 2021, price: 132000, location: 'Accra', condition: 'FOREIGN_USED', mileage: 38500, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '1.8L 4-Cylinder', bodyType: 'Sedan', color: 'Silver Metallic', colorHex: '#94a3b8', featured: true, description: 'Well maintained foreign used 2021 Corolla LE. Reverse camera, cruise control, economical 1.8L engine. Duty fully paid, accident free.', features: ['Reverse Camera', 'Cruise Control', 'Bluetooth', 'Keyless Entry'] },
  { make: 'Toyota', model: 'Hilux', year: 2020, price: 285000, location: 'Tema', condition: 'FOREIGN_USED', mileage: 62000, transmission: 'AUTOMATIC', fuelType: 'DIESEL', engineSize: '2.8L Turbo Diesel', bodyType: 'Pickup', color: 'White', colorHex: '#f8fafc', featured: true, description: 'Tough 2020 Hilux Revo 2.8 Diesel 4x4. Newly fitted all-terrain tyres, tow hitch, and roll bar. Serviced every 5,000 km with records.', features: ['4WD', 'Tow Hitch', 'Roll Bar', 'Touchscreen', 'Reverse Camera'] },
  { make: 'Hyundai', model: 'Accent', year: 2019, price: 89000, location: 'Kumasi', condition: 'LOCALLY_USED', mileage: 78000, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '1.6L', bodyType: 'Sedan', color: 'Graphite Gray', colorHex: '#475569', featured: false, description: 'Reliable locally used Accent. Newly replaced battery and tyres, AC ice cold, perfect first car or bolt business unit.', features: ['Bluetooth', 'USB', 'Fabric Seats'] },
  { make: 'Toyota', model: 'RAV4', year: 2021, price: 245000, location: 'Accra', condition: 'FOREIGN_USED', mileage: 41000, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '2.5L 4-Cylinder', bodyType: 'SUV', color: 'Blue Metallic', colorHex: '#1e3a8a', featured: true, description: '2021 RAV4 XLE AWD. Blind spot monitor, cross traffic alert, power liftgate. Home use only, never driven rough roads.', features: ['AWD', 'Blind Spot Monitor', 'Power Liftgate', 'CarPlay', 'Sunroof'] },
  { make: 'Kia', model: 'Sportage', year: 2020, price: 178000, location: 'Takoradi', condition: 'FOREIGN_USED', mileage: 47500, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '2.0L', bodyType: 'SUV', color: 'Titanium Silver', colorHex: '#94a3b8', featured: false, pending: true, description: 'Sporty 2020 Sportage EX. Panoramic sunroof, heated seats, lane keep assist. Arrived last month, duty paid.', features: ['Panoramic Roof', 'Heated Seats', 'Lane Assist', 'Alloy Wheels'] },
  { make: 'Honda', model: 'CR-V', year: 2019, price: 205000, location: 'Accra', condition: 'FOREIGN_USED', mileage: 55600, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '1.5L Turbo', bodyType: 'SUV', color: 'Modern Steel', colorHex: '#64748b', featured: false, description: 'Family favourite CR-V AWD with huge boot space. Honda sensing safety suite, remote engine start, dual zone climate.', features: ['AWD', 'Honda Sensing', 'Remote Start', 'Cruise Control'] },
  { make: 'Mercedes', model: 'C-Class', year: 2020, price: 310000, location: 'Accra', condition: 'FOREIGN_USED', mileage: 36000, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '2.0L Turbo', bodyType: 'Sedan', color: 'Obsidian Black', colorHex: '#0f172a', featured: true, description: '2020 C300 AMG Line. Burmester sound, ambient lighting, panoramic roof, 360 camera. Full service history available.', features: ['AMG Package', 'Burmester Audio', '360 Camera', 'Ambient Lighting'] },
  { make: 'Suzuki', model: 'Swift', year: 2022, price: 115000, location: 'Kumasi', condition: 'BRAND_NEW', mileage: 3200, transmission: 'MANUAL', fuelType: 'PETROL', engineSize: '1.2L', bodyType: 'Hatchback', color: 'Solid Red', colorHex: '#dc2626', featured: false, description: 'Nearly new Swift GL manual. Extremely fuel efficient, push start, and remaining factory warranty. Ideal city runabout.', features: ['Push Start', 'Bluetooth', 'ABS', 'Airbags'] },
  { make: 'Nissan', model: 'Sentra', year: 2019, price: 98000, location: 'Tamale', condition: 'LOCALLY_USED', mileage: 64800, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '1.6L', bodyType: 'Sedan', color: 'Super Black', colorHex: '#1f2937', featured: false, description: 'Clean Sentra, locally used in Tamale. Chassis never welded, AC working perfectly, ready to drive away today.', features: ['Bluetooth', 'Reverse Sensors'] },
  { make: 'Toyota', model: 'Yaris', year: 2018, price: 72000, location: 'Accra', condition: 'LOCALLY_USED', mileage: 89300, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '1.5L', bodyType: 'Sedan', color: 'Pearl White', colorHex: '#f8fafc', featured: false, description: 'Economical Yaris sedan. Recent full service with new brake pads and shocks. Perfect for daily commute.', features: ['Bluetooth', 'USB', 'Fabric Seats'] },
  { make: 'Ford', model: 'Ranger', year: 2020, price: 268000, location: 'Tema', condition: 'FOREIGN_USED', mileage: 58000, transmission: 'AUTOMATIC', fuelType: 'DIESEL', engineSize: '2.0L Bi-Turbo', bodyType: 'Pickup', color: 'Lightning Blue', colorHex: '#1d4ed8', featured: false, pending: true, description: '2020 Ranger XLT 2.0 Bi-Turbo 4x4. Side steps, bed liner, and dual battery system fitted. Ready for the site or the family.', features: ['4WD', 'Bed Liner', 'Side Steps', 'Dual Battery'] },
  { make: 'Hyundai', model: 'Sonata', year: 2021, price: 162000, location: 'Kumasi', condition: 'FOREIGN_USED', mileage: 33400, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '2.5L', bodyType: 'Sedan', color: 'Hampton Gray', colorHex: '#4b5563', featured: false, description: 'Sharp 2021 Sonata SEL with digital cluster, wireless CarPlay, and smart cruise. Smooth highway cruiser.', features: ['Digital Cluster', 'CarPlay', 'Smart Cruise', 'Lane Assist'] },
  { make: 'Toyota', model: 'Vitz', year: 2018, price: 65000, location: 'Takoradi', condition: 'FOREIGN_USED', mileage: 52700, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '1.0L', bodyType: 'Hatchback', color: 'Lime Green', colorHex: '#65a30d', featured: false, description: 'Pocket-friendly Vitz hatchback. Amazing on fuel, compact for city parking, new tyres fitted last month.', features: ['Bluetooth', 'Push Start'] },
  { make: 'Honda', model: 'Fit', year: 2020, price: 105000, location: 'Accra', condition: 'FOREIGN_USED', mileage: 35800, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '1.3L Hybrid', bodyType: 'Hatchback', color: 'Sky Blue', colorHex: '#0ea5e9', featured: false, pending: true, description: 'Hybrid Honda Fit Shuttle. Ultra low fuel consumption, paddle shifters, and the famous magic seats for cargo.', features: ['Hybrid', 'Paddle Shifters', 'Magic Seats', 'Push Start'] },
  { make: 'Nissan', model: 'Patrol', year: 2018, price: 420000, location: 'Accra', condition: 'FOREIGN_USED', mileage: 61500, transmission: 'AUTOMATIC', fuelType: 'PETROL', engineSize: '5.6L V8', bodyType: 'SUV', color: 'Pearl White', colorHex: '#f8fafc', featured: true, description: 'Flagship 2018 Patrol Platinum V8. Leather captains chairs, rear entertainment, chilled seats, and full-time 4WD. A presence on any road.', features: ['V8 Engine', 'Leather Seats', 'Rear Entertainment', 'Cooled Seats', '4WD'] },
];

async function main() {
  const sellers = await prisma.sellerProfile.findMany({
    where: { user: { isActive: true } },
    orderBy: { id: 'asc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (sellers.length === 0) {
    console.error('❌ No active sellers found. Nothing to attach listings to (this script never creates sellers).');
    process.exit(1);
  }

  console.log(`👤 Found ${sellers.length} current seller(s):`);
  sellers.forEach((s) => console.log(`   - ${s.user.name} <${s.user.email}> (#${s.id}, ${s.sellerType})`));

  let created = 0;
  let skipped = 0;
  const perSeller = Object.fromEntries(sellers.map((s) => [s.id, { created: 0, skipped: 0 }]));

  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i];
    const seller = sellers[i % sellers.length];

    const exists = await prisma.vehicle.findFirst({
      where: { sellerId: seller.id, make: item.make, model: item.model, year: item.year },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      perSeller[seller.id].skipped += 1;
      console.log(`↩️  Skip ${item.year} ${item.make} ${item.model} — ${seller.user.name} already has one`);
      continue;
    }

    const status = item.pending ? 'PENDING' : 'AVAILABLE';
    if (DRY_RUN) {
      created += 1;
      perSeller[seller.id].created += 1;
      console.log(`[dry-run] Would create ${item.year} ${item.make} ${item.model} (${status}) for ${seller.user.name}`);
      continue;
    }

    await prisma.vehicle.create({
      data: {
        sellerId: seller.id,
        make: item.make,
        model: item.model,
        year: item.year,
        price: item.price,
        location: item.location,
        condition: item.condition,
        mileage: item.mileage,
        transmission: item.transmission,
        fuelType: item.fuelType,
        engineSize: item.engineSize,
        bodyType: item.bodyType,
        color: item.color,
        description: item.description,
        status,
        featured: item.featured && status === 'AVAILABLE',
        images: { create: [{ data: carSvg(item.make, item.model, item.colorHex), isPrimary: true }] },
        features: { create: item.features.map((f) => ({ featureName: f })) },
      },
    });
    created += 1;
    perSeller[seller.id].created += 1;
    console.log(`🚗 Created ${item.year} ${item.make} ${item.model} (${status}) for ${seller.user.name}`);
  }

  console.log('\n📊 Summary:');
  sellers.forEach((s) => {
    const s2 = perSeller[s.id];
    console.log(`   ${s.user.name}: +${s2.created} new, ${s2.skipped} skipped (now visible in their dashboard)`);
  });
  console.log(DRY_RUN ? '\nDry run — nothing was written.' : `\n✅ Done: ${created} listing(s) added, ${skipped} skipped. PENDING ones await admin approval.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
