-- Convert existing GHS floats to integer pesewas BEFORE the type change,
-- so 50.0 (GHS) becomes 5000 (pesewas) instead of rounding to 50.
UPDATE `payment` SET `amount` = ROUND(`amount` * 100);

-- AlterTable
ALTER TABLE `payment` MODIFY `amount` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `message_vehicleId_createdAt_idx` ON `message`(`vehicleId`, `createdAt`);

-- CreateIndex
CREATE INDEX `vehicle_status_createdAt_idx` ON `vehicle`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `vehicle_status_price_idx` ON `vehicle`(`status`, `price`);

-- CreateIndex
CREATE INDEX `vehicle_make_model_idx` ON `vehicle`(`make`, `model`);

-- CreateIndex
CREATE INDEX `vehicle_featured_status_idx` ON `vehicle`(`featured`, `status`);
