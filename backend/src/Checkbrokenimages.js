/**
 * checkBrokenImages.js
 *
 * Finds VehicleImage (and VehicleDocument) rows whose data field is null or empty.
 * Images are now stored as Base64 in the database, so this script no longer checks
 * for missing files on disk.
 *
 * Usage:
 *   node checkBrokenImages.js            -> just report broken rows
 *   node checkBrokenImages.js --delete   -> also delete the broken rows from the DB
 *
 * Place this file at your project root (next to index.js).
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTable(modelName, rows) {
  const broken = [];

  for (const row of rows) {
    if (!row.data || row.data.trim() === '') {
      broken.push({ ...row, reason: 'Data field is empty or null' });
    }
  }

  console.log(`\n=== ${modelName}: ${rows.length} total, ${broken.length} broken ===`);
  broken.forEach(b => {
    console.log(`  [id=${b.id}] vehicleId=${b.vehicleId} -> ${b.reason}`);
  });

  return broken;
}

async function main() {
  const shouldDelete = process.argv.includes('--delete');

  const images = await prisma.vehicleImage.findMany();
  const documents = await prisma.vehicleDocument.findMany();

  const brokenImages = await checkTable('VehicleImage', images);
  const brokenDocs = await checkTable('VehicleDocument', documents);

  const totalBroken = brokenImages.length + brokenDocs.length;

  if (totalBroken === 0) {
    console.log('\nNo broken image/document references found. 🎉');
  } else if (shouldDelete) {
    console.log(`\nDeleting ${totalBroken} broken row(s)...`);
    if (brokenImages.length) {
      await prisma.vehicleImage.deleteMany({
        where: { id: { in: brokenImages.map(b => b.id) } }
      });
    }
    if (brokenDocs.length) {
      await prisma.vehicleDocument.deleteMany({
        where: { id: { in: brokenDocs.map(b => b.id) } }
      });
    }
    console.log('Done. Affected listings will now show "no image" instead of a broken icon');
    console.log('until sellers re-upload photos via Edit Listing.');
  } else {
    console.log(`\n${totalBroken} broken row(s) found. Re-run with --delete to remove them:`);
    console.log('  node checkBrokenImages.js --delete');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
