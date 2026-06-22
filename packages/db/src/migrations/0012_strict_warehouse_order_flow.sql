ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'ready_for_dispatch';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'partially_invoiced';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'invoiced';
