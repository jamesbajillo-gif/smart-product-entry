-- =====================================================
-- Add created_by and updated_by columns to products table
-- =====================================================
-- This script safely adds the missing columns needed for
-- tracking who created and updated products
-- Run this in your MySQL database
-- =====================================================

-- Check if columns exist before adding (safe approach)
-- For MySQL 5.7+ and MariaDB 10.2+

-- Add created_by column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'created_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Column exists, do nothing
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(100) DEFAULT NULL COMMENT "Name of the operator who created the product"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add updated_by column if it doesn't exist
SET @columnname = 'updated_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Column exists, do nothing
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(100) DEFAULT NULL COMMENT "Name of the operator who last updated the product"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add indexes if they don't exist
-- Index for created_by
SET @indexname = 'idx_created_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @indexname)
  ) > 0,
  'SELECT 1', -- Index exists, do nothing
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, ' (created_by)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Index for updated_by
SET @indexname = 'idx_updated_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @indexname)
  ) > 0,
  'SELECT 1', -- Index exists, do nothing
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, ' (updated_by)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify the columns were added:
-- DESCRIBE products;
-- 
-- Or check specific columns:
-- SELECT 
--   COLUMN_NAME, 
--   DATA_TYPE, 
--   IS_NULLABLE, 
--   COLUMN_DEFAULT,
--   COLUMN_COMMENT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'products'
--   AND COLUMN_NAME IN ('created_by', 'updated_by');
-- =====================================================

