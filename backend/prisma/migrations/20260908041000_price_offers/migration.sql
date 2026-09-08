-- Price negotiation offers + agreed-offer link on purchases

-- CreateEnum PriceOfferStatus
CREATE TYPE "PriceOfferStatus" AS ENUM ('PENDING', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'USED');

-- CreateTable priceoffer
CREATE TABLE "priceoffer" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "status" "PriceOfferStatus" NOT NULL DEFAULT 'PENDING',
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "priceoffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "priceoffer_vehicleId_idx" ON "priceoffer"("vehicleId");
CREATE INDEX "priceoffer_buyerId_idx" ON "priceoffer"("buyerId");
CREATE INDEX "priceoffer_sellerId_idx" ON "priceoffer"("sellerId");

ALTER TABLE "priceoffer" ADD CONSTRAINT "priceoffer_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "priceoffer" ADD CONSTRAINT "priceoffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "priceoffer" ADD CONSTRAINT "priceoffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellerprofile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Purchases made at a negotiated price back-reference the accepted offer
ALTER TABLE "purchase" ADD COLUMN "agreedOfferId" INTEGER;
