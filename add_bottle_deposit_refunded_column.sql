-- Add bottle_deposit_refunded column to sales table
-- This column tracks whether bottle deposits have been refunded (0 = not refunded, 1 = refunded)

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS bottle_deposit_refunded TINYINT(1) DEFAULT 0;

