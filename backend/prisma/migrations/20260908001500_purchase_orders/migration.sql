-- Escrow vehicle-purchase orders + reservation status + seller payout fields

-- AlterEnum (add RESERVED to VehicleStatus)
ALTER TYPE "VehicleStatus" ADD VALUE 'RESERVED';

-- AlterTable sellerprofile: payout account for escrow releases
ALTER TABLE "sellerprofile" ADD COLUMN "payoutMethod" TEXT,
ADD COLUMN "payoutAccount" TEXT,
ADD COLUMN "payoutName" TEXT;

-- CreateEnum PurchaseStatus
CREATE TYPE "PurchaseStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID_HELD', 'HANDOVER_PENDING', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateTable purchase
CREATE TABLE "purchase" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "channel" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "deliveryMode" TEXT NOT NULL DEFAULT 'PICKUP',
    "address" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "commissionBps" INTEGER NOT NULL DEFAULT 0,
    "payoutStatus" TEXT NOT NULL DEFAULT 'NONE',
    "payoutRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_reference_key" ON "purchase"("reference");
CREATE INDEX "purchase_buyerId_idx" ON "purchase"("buyerId");
CREATE INDEX "purchase_vehicleId_idx" ON "purchase"("vehicleId");
CREATE INDEX "purchase_sellerId_idx" ON "purchase"("sellerId");
CREATE INDEX "purchase_status_idx" ON "purchase"("status");

ALTER TABLE "purchase" ADD CONSTRAINT "purchase_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellerprofile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
