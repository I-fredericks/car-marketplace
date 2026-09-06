-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AvatarStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('PRIVATE', 'DEALER', 'COMPANY');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('BRAND_NEW', 'FOREIGN_USED', 'LOCALLY_USED');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('PENDING', 'AVAILABLE', 'REJECTED', 'SOLD', 'DEACTIVATED', 'REMOVED');

-- CreateEnum
CREATE TYPE "PaymentPlan" AS ENUM ('BASIC', 'PLUS', 'DEALER_BASIC', 'DEALER_PRO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'BUYER',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatar" TEXT,
    "avatarStatus" "AvatarStatus" NOT NULL DEFAULT 'NONE',
    "avatarRejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "senderId" INTEGER,
    "vehicleId" INTEGER,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authtoken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authtoken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellerprofile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "whatsapp" TEXT,
    "location" TEXT,
    "sellerType" "SellerType" NOT NULL DEFAULT 'PRIVATE',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellerprofile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "condition" "Condition" NOT NULL DEFAULT 'FOREIGN_USED',
    "mileage" INTEGER,
    "transmission" "Transmission" NOT NULL DEFAULT 'AUTOMATIC',
    "fuelType" "FuelType" NOT NULL DEFAULT 'PETROL',
    "engineSize" TEXT,
    "driveType" TEXT,
    "bodyType" TEXT,
    "color" TEXT,
    "doors" INTEGER,
    "seats" INTEGER,
    "description" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'PENDING',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicleimage" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vehicleimage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiclefeature" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "featureName" TEXT NOT NULL,

    CONSTRAINT "vehiclefeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicledocument" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "vehicledocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" SERIAL NOT NULL,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "vehicleId" INTEGER,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "plan" "PaymentPlan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "channel" TEXT,
    "paidAt" TIMESTAMP(3),
    "vehicleId" INTEGER,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "plan" "PaymentPlan" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditlog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "actorRole" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditlog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_type_senderId_vehicleId_idx" ON "notification"("userId", "type", "senderId", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "authtoken_tokenHash_key" ON "authtoken"("tokenHash");

-- CreateIndex
CREATE INDEX "authtoken_userId_idx" ON "authtoken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "sellerprofile"("userId");

-- CreateIndex
CREATE INDEX "vehicle_sellerId_idx" ON "vehicle"("sellerId");

-- CreateIndex
CREATE INDEX "vehicle_status_createdAt_idx" ON "vehicle"("status", "createdAt");

-- CreateIndex
CREATE INDEX "vehicle_status_price_idx" ON "vehicle"("status", "price");

-- CreateIndex
CREATE INDEX "vehicle_make_model_idx" ON "vehicle"("make", "model");

-- CreateIndex
CREATE INDEX "vehicle_featured_status_idx" ON "vehicle"("featured", "status");

-- CreateIndex
CREATE INDEX "vehicleimage_vehicleId_idx" ON "vehicleimage"("vehicleId");

-- CreateIndex
CREATE INDEX "vehiclefeature_vehicleId_idx" ON "vehiclefeature"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicledocument_vehicleId_idx" ON "vehicledocument"("vehicleId");

-- CreateIndex
CREATE INDEX "favorite_vehicleId_idx" ON "favorite"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_userId_vehicleId_key" ON "favorite"("userId", "vehicleId");

-- CreateIndex
CREATE INDEX "message_receiverId_idx" ON "message"("receiverId");

-- CreateIndex
CREATE INDEX "message_senderId_idx" ON "message"("senderId");

-- CreateIndex
CREATE INDEX "message_vehicleId_idx" ON "message"("vehicleId");

-- CreateIndex
CREATE INDEX "message_vehicleId_createdAt_idx" ON "message"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "review_authorId_idx" ON "review"("authorId");

-- CreateIndex
CREATE INDEX "review_sellerId_idx" ON "review"("sellerId");

-- CreateIndex
CREATE INDEX "report_reporterId_idx" ON "report"("reporterId");

-- CreateIndex
CREATE INDEX "report_vehicleId_idx" ON "report"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reference_key" ON "payment"("reference");

-- CreateIndex
CREATE INDEX "payment_userId_idx" ON "payment"("userId");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_userId_key" ON "subscription"("userId");

-- CreateIndex
CREATE INDEX "auditlog_createdAt_idx" ON "auditlog"("createdAt");

-- CreateIndex
CREATE INDEX "auditlog_action_idx" ON "auditlog"("action");

-- CreateIndex
CREATE INDEX "auditlog_entityType_entityId_idx" ON "auditlog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "auditlog_actorId_idx" ON "auditlog"("actorId");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authtoken" ADD CONSTRAINT "authtoken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellerprofile" ADD CONSTRAINT "sellerprofile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellerprofile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicleimage" ADD CONSTRAINT "vehicleimage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiclefeature" ADD CONSTRAINT "vehiclefeature_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicledocument" ADD CONSTRAINT "vehicledocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellerprofile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

