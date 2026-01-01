-- Add unpaid transaction columns to sales table
-- This allows tracking transactions that haven't been paid yet

ALTER TABLE `sales`
ADD COLUMN `is_unpaid` TINYINT(1) DEFAULT 0 COMMENT '0 = paid, 1 = unpaid' AFTER `change_amount`,
ADD COLUMN `unpaid_notes` TEXT NULL COMMENT 'Notes explaining why transaction is unpaid' AFTER `is_unpaid`;

-- Add index for filtering unpaid transactions
CREATE INDEX `idx_is_unpaid` ON `sales` (`is_unpaid`);

