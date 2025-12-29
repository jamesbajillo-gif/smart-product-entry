-- =====================================================
-- Add Categories Column to Fees Table
-- =====================================================
-- This script adds the categories column to the fees table
-- if it doesn't already exist
-- =====================================================

-- Add categories column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'fees';
SET @columnname = 'categories';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' JSON DEFAULT NULL COMMENT ''Array of category names that this fee applies to. NULL means applies to all categories.''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

