-- Car payments move off % card rails onto flat-fee platform collection:
-- buyer transfers to CarMarket's account and an admin confirms receipt.

ALTER TABLE "purchase" ADD COLUMN "paymentRef" TEXT,
ADD COLUMN "payerName" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3);
