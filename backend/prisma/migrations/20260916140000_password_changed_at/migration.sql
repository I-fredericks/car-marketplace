-- Password-change session revocation: sessions minted before this
-- timestamp are rejected at the auth gate.
ALTER TABLE "user" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
