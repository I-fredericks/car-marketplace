-- Escrow handover step: seller marks the car physically handed to the buyer
ALTER TABLE "purchase" ADD COLUMN "sellerHandoverAt" TIMESTAMP(3);
