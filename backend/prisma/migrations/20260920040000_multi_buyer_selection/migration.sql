-- Multi-buyer interest model: orders no longer reserve the listing;
-- the seller picks a buyer (selectedBuyerAt) and the listing only comes
-- off the market when admin confirms that buyers payment.
ALTER TABLE "purchase" ADD COLUMN "selectedBuyerAt" TIMESTAMP(3);
