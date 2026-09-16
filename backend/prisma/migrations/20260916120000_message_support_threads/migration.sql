-- Support threads: an admin can open a conversation with any user without a
-- listing attached. vehicleId NULL = the listing-less thread for that pair;
-- every listing-anchored chat keeps its vehicleId.
ALTER TABLE "message" DROP CONSTRAINT "message_vehicleId_fkey";
ALTER TABLE "message" ALTER COLUMN "vehicleId" DROP NOT NULL;
ALTER TABLE "message" ADD CONSTRAINT "message_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
