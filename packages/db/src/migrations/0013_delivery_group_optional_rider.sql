ALTER TYPE "delivery_group_status" ADD VALUE IF NOT EXISTS 'pending_assignment';

ALTER TABLE "delivery_group" ALTER COLUMN "deliveryman_id" DROP NOT NULL;
