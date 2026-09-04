-- AlterTable
ALTER TABLE `notification` ADD COLUMN `senderId` INTEGER NULL,
    ADD COLUMN `vehicleId` INTEGER NULL,
    MODIFY `data` JSON NULL;

-- CreateIndex
CREATE INDEX `notification_userId_type_senderId_vehicleId_idx` ON `notification`(`userId`, `type`, `senderId`, `vehicleId`);
