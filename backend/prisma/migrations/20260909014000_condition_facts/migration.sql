-- Structured condition facts on listings (filterable discovery):
-- noKnownFaults / firstOwner / registered / exchangePossible + issueNote
ALTER TABLE "vehicle" ADD COLUMN "noKnownFaults" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "firstOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "registered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "exchangePossible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "issueNote" TEXT;

CREATE INDEX "vehicle_noKnownFaults_idx" ON "vehicle"("noKnownFaults");
CREATE INDEX "vehicle_firstOwner_idx" ON "vehicle"("firstOwner");
CREATE INDEX "vehicle_registered_idx" ON "vehicle"("registered");
CREATE INDEX "vehicle_exchangePossible_idx" ON "vehicle"("exchangePossible");
