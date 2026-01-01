-- =====================================================
-- Add services and suppliers columns to products table
-- =====================================================
-- This script safely adds the missing columns needed for
-- storing product services and suppliers as JSON
-- Run this in your MySQL database
-- =====================================================

-- Check if columns exist before adding (safe approach)
-- For MySQL 5.7+ and MariaDB 10.2+

-- Add suppliers column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'suppliers';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Column exists, do nothing
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' JSON DEFAULT NULL COMMENT "Product suppliers stored as JSON array"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add services column if it doesn't exist
SET @columnname = 'services';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Column exists, do nothing
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' JSON DEFAULT NULL COMMENT "Product services/add-ons stored as JSON array"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

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
--   AND COLUMN_NAME IN ('suppliers', 'services');
-- =====================================================

