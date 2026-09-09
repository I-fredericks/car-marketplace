-- Buyer-protection disputes on escrowed orders
ALTER TABLE "purchase" ADD COLUMN "disputeStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN "disputeReason" TEXT,
ADD COLUMN "disputeOpenedAt" TIMESTAMP(3),
ADD COLUMN "disputeResolvedAt" TIMESTAMP(3);

CREATE INDEX "purchase_disputeStatus_idx" ON "purchase"("disputeStatus");
