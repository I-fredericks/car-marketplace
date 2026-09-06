-- AlterTable
ALTER TABLE `user` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `vehicle` MODIFY `status` ENUM('PENDING', 'AVAILABLE', 'REJECTED', 'SOLD', 'DEACTIVATED', 'REMOVED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `auditlog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NULL,
    `actorRole` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditlog_createdAt_idx`(`createdAt`),
    INDEX `auditlog_action_idx`(`action`),
    INDEX `auditlog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `auditlog_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
