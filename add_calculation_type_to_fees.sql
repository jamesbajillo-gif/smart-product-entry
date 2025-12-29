-- =====================================================
-- Add Calculation Type Column to Fees Table
-- =====================================================
-- This script adds the calculation_type column to specify
-- whether a fee is calculated per item or per transaction
-- =====================================================
Failed to load resource: net::ERR_BLOCKED_BY_CLIENTUnderstand this error
/src/components/Orde…?t=1766930077715:38 Uncaught SyntaxError: Identifier 'editingTotalItemId' has already been declared
-- Add calculation_type column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'fees';
SET @columnname = 'calculation_type';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' ENUM(''per_item'', ''per_transaction'') DEFAULT ''per_transaction'' COMMENT ''per_item = fee applies to each matching item, per_transaction = fee applies once per transaction''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

