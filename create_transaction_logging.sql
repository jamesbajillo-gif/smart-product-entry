-- =====================================================
-- Smart Product Entry - Transaction Logging with Operator Support
-- =====================================================
-- This script adds transaction logging with operator tracking
-- Works with MySQL 5.7+ and MariaDB 10.2+
-- =====================================================

DELIMITER $$

-- Procedure to safely add columns
DROP PROCEDURE IF EXISTS AddColumnIfNotExists$$
CREATE PROCEDURE AddColumnIfNotExists(
  IN p_table_name VARCHAR(255),
  IN p_column_name VARCHAR(255),
  IN p_column_definition TEXT
)
BEGIN
  DECLARE v_column_exists INT DEFAULT 0;
  DECLARE v_db_name VARCHAR(255);
  
  SELECT DATABASE() INTO v_db_name;
  
  SELECT COUNT(*) INTO v_column_exists
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = v_db_name
    AND TABLE_NAME = p_table_name
    AND COLUMN_NAME = p_column_name;
  
  IF v_column_exists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_column_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('✓ Added column ', p_column_name, ' to table ', p_table_name) AS result;
  ELSE
    SELECT CONCAT('→ Column ', p_column_name, ' already exists in table ', p_table_name) AS result;
  END IF;
END$$

-- Procedure to safely add index
DROP PROCEDURE IF EXISTS AddIndexIfNotExists$$
CREATE PROCEDURE AddIndexIfNotExists(
  IN p_table_name VARCHAR(255),
  IN p_index_name VARCHAR(255),
  IN p_index_definition TEXT
)
BEGIN
  DECLARE v_index_exists INT DEFAULT 0;
  DECLARE v_db_name VARCHAR(255);
  
  SELECT DATABASE() INTO v_db_name;
  
  SELECT COUNT(*) INTO v_index_exists
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = v_db_name
    AND TABLE_NAME = p_table_name
    AND INDEX_NAME = p_index_name;
  
  IF v_index_exists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD INDEX `', p_index_name, '` ', p_index_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('✓ Added index ', p_index_name, ' to table ', p_table_name) AS result;
  ELSE
    SELECT CONCAT('→ Index ', p_index_name, ' already exists in table ', p_table_name) AS result;
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- STEP 1: Create transaction_log table
-- =====================================================

CREATE TABLE IF NOT EXISTS transaction_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type VARCHAR(50) NOT NULL COMMENT 'sale, stock_adjustment, expense, store_fund, product_create, product_update, product_delete',
  transaction_id INT DEFAULT NULL COMMENT 'ID of the related record (sale_id, stock_adjustment_id, etc.)',
  table_name VARCHAR(100) DEFAULT NULL COMMENT 'Name of the table affected',
  operator_name VARCHAR(100) NOT NULL COMMENT 'Name of the operator who performed the action',
  action VARCHAR(50) NOT NULL COMMENT 'create, update, delete',
  data_before JSON DEFAULT NULL COMMENT 'Data before the change (for updates/deletes)',
  data_after JSON DEFAULT NULL COMMENT 'Data after the change (for creates/updates)',
  description TEXT COMMENT 'Human-readable description of the transaction',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP address of the client',
  user_agent TEXT DEFAULT NULL COMMENT 'User agent string',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_operator_name (operator_name),
  INDEX idx_created_at (created_at),
  INDEX idx_transaction_id (transaction_id, transaction_type),
  INDEX idx_table_name (table_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STEP 2: Add operator_name column to existing tables
-- =====================================================

-- Add operator_name to sales table
CALL AddColumnIfNotExists('sales', 'operator_name', 'VARCHAR(100) DEFAULT NULL COMMENT "Name of the operator who processed the sale"');
CALL AddIndexIfNotExists('sales', 'idx_operator_name', '(operator_name)');

-- Add operator_name to stock_adjustments table
CALL AddColumnIfNotExists('stock_adjustments', 'operator_name', 'VARCHAR(100) DEFAULT NULL COMMENT "Name of the operator who made the adjustment"');
CALL AddIndexIfNotExists('stock_adjustments', 'idx_operator_name', '(operator_name)');

-- Add operator_name to expenses table
CALL AddColumnIfNotExists('expenses', 'operator_name', 'VARCHAR(100) DEFAULT NULL COMMENT "Name of the operator who recorded the expense"');
CALL AddIndexIfNotExists('expenses', 'idx_operator_name', '(operator_name)');

-- Add operator_name to store_funds table
CALL AddColumnIfNotExists('store_funds', 'operator_name', 'VARCHAR(100) DEFAULT NULL COMMENT "Name of the operator who made the transaction"');
CALL AddIndexIfNotExists('store_funds', 'idx_operator_name', '(operator_name)');

-- Add operator_name to products table (for create/update/delete tracking)
CALL AddColumnIfNotExists('products', 'created_by', 'VARCHAR(100) DEFAULT NULL COMMENT "Name of the operator who created the product"');
CALL AddColumnIfNotExists('products', 'updated_by', 'VARCHAR(100) DEFAULT NULL COMMENT "Name of the operator who last updated the product"');
CALL AddIndexIfNotExists('products', 'idx_created_by', '(created_by)');
CALL AddIndexIfNotExists('products', 'idx_updated_by', '(updated_by)');

-- =====================================================
-- STEP 5: Clean up procedures
-- =====================================================

DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DROP PROCEDURE IF EXISTS AddIndexIfNotExists;

-- =====================================================
-- STEP 6: Verification Queries
-- =====================================================

-- Check transaction_log table structure
-- DESCRIBE transaction_log;

-- Check if operator_name columns were added
-- SELECT 
--   TABLE_NAME,
--   COLUMN_NAME,
--   DATA_TYPE,
--   IS_NULLABLE,
--   COLUMN_DEFAULT
-- FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND COLUMN_NAME IN ('operator_name', 'created_by', 'updated_by')
-- ORDER BY TABLE_NAME, COLUMN_NAME;

-- =====================================================
-- MIGRATION SUMMARY
-- =====================================================
-- 
-- Created Tables:
--   ✓ transaction_log (comprehensive audit log)
--
-- Added Columns:
--   ✓ sales.operator_name
--   ✓ stock_adjustments.operator_name
--   ✓ expenses.operator_name
--   ✓ store_funds.operator_name
--   ✓ products.created_by
--   ✓ products.updated_by
--
-- Added Indexes:
--   ✓ transaction_log.idx_transaction_type
--   ✓ transaction_log.idx_operator_name
--   ✓ transaction_log.idx_created_at
--   ✓ transaction_log.idx_transaction_id
--   ✓ transaction_log.idx_table_name
--   ✓ sales.idx_operator_name
--   ✓ stock_adjustments.idx_operator_name
--   ✓ expenses.idx_operator_name
--   ✓ store_funds.idx_operator_name
--   ✓ products.idx_created_by
--   ✓ products.idx_updated_by
--
-- =====================================================
-- END OF MIGRATION SCRIPT
-- =====================================================

