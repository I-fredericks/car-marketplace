-- Link reviews to completed purchases (one review per transaction)
ALTER TABLE "review" ADD COLUMN "purchaseId" INTEGER NOT NULL;

CREATE UNIQUE INDEX "review_purchaseId_key" ON "review"("purchaseId");

ALTER TABLE "review" ADD CONSTRAINT "review_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
