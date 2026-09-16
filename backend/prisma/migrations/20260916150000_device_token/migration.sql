-- FCM push: registration token for offline delivery (skipped when the
-- user has an open SSE stream).
ALTER TABLE "user" ADD COLUMN "deviceToken" TEXT;
