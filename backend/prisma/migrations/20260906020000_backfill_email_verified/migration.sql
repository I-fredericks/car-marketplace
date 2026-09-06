-- Existing accounts predate email confirmation; grandfather them as verified
-- so only NEW registrations have to confirm their inbox.
UPDATE `user` SET `emailVerified` = 1 WHERE `emailVerified` = 0;
