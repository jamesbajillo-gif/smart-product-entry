-- =====================================================
-- Smart Product Entry - Comprehensive Database Migration
-- =====================================================
-- This script addresses all schema gaps and optimizations
-- identified in the database review
-- 
-- Target: MySQL 5.7+ / 8.0+ / MariaDB 10.2+
-- Safe to run: Yes (checks before adding columns/indexes)
-- =====================================================

-- =====================================================
-- STEP 1: Create procedure to safely add columns
-- =====================================================

DELIMITER $$

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

-- Procedure to safely add index if it doesn't exist
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
-- STEP 2: Add missing columns to products table
-- =====================================================
-- High Priority: Required for multi-supplier support

CALL AddColumnIfNotExists('products', 'suppliers', 'JSON DEFAULT NULL');
CALL AddColumnIfNotExists('products', 'price_per_piece', 'DECIMAL(10,2) DEFAULT NULL');
CALL AddColumnIfNotExists('products', 'price_per_pack', 'DECIMAL(10,2) DEFAULT NULL');
CALL AddColumnIfNotExists('products', 'variations', 'JSON DEFAULT NULL');

-- =====================================================
-- STEP 3: Add missing columns to sales table
-- =====================================================
-- Medium Priority: For bottle deposit tracking

CALL AddColumnIfNotExists('sales', 'bottle_deposit_total', 'DECIMAL(10,2) DEFAULT 0');
CALL AddColumnIfNotExists('sales', 'bottle_deposit_refunded', 'TINYINT(1) DEFAULT 0');

-- =====================================================
-- STEP 4: Add missing columns to expenses table
-- =====================================================
-- Already present in schema, but ensuring consistency

CALL AddColumnIfNotExists('expenses', 'category', 'VARCHAR(100)');
CALL AddColumnIfNotExists('expenses', 'payment_source', "VARCHAR(50) DEFAULT 'cash'");

-- =====================================================
-- STEP 5: Add missing columns to quantity_history table
-- =====================================================
-- Low Priority: Audit trail improvement

CALL AddColumnIfNotExists('quantity_history', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

-- =====================================================
-- STEP 6: Add performance indexes to products table
-- =====================================================
-- High Priority: Frequently queried columns

CALL AddIndexIfNotExists('products', 'idx_category', '(category)');
CALL AddIndexIfNotExists('products', 'idx_skip_stock', '(skip_stock_tracking)');
CALL AddIndexIfNotExists('products', 'idx_stock_low', '(stock_quantity, low_stock_threshold)');

-- =====================================================
-- STEP 7: Add performance indexes to sales table
-- =====================================================
-- High Priority: Date range and payment method queries

CALL AddIndexIfNotExists('sales', 'idx_payment_method', '(payment_method)');
CALL AddIndexIfNotExists('sales', 'idx_created_at', '(created_at)');
CALL AddIndexIfNotExists('sales', 'idx_date_payment', '(created_at, payment_method)');
CALL AddIndexIfNotExists('sales', 'idx_bottle_deposit', '(bottle_deposit_refunded)');

-- =====================================================
-- STEP 8: Add performance indexes to store_funds table
-- =====================================================
-- Medium Priority: Category filtering

CALL AddIndexIfNotExists('store_funds', 'idx_category', '(category)');

-- =====================================================
-- STEP 9: Update character set and collation
-- =====================================================
-- Low Priority: Better Unicode support
-- Note: This may take time on large tables

-- Uncomment if you want to convert to utf8mb4
-- ALTER TABLE products CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE sales CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE stock_adjustments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE expenses CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE quantity_history CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE store_funds CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================================
-- STEP 10: Ensure InnoDB engine (if not already)
-- =====================================================
-- Low Priority: Explicit engine specification

-- Uncomment if you want to explicitly set engine
-- ALTER TABLE products ENGINE=InnoDB;
-- ALTER TABLE sales ENGINE=InnoDB;
-- ALTER TABLE stock_adjustments ENGINE=InnoDB;
-- ALTER TABLE expenses ENGINE=InnoDB;
-- ALTER TABLE quantity_history ENGINE=InnoDB;
-- ALTER TABLE store_funds ENGINE=InnoDB;

-- =====================================================
-- STEP 11: Clean up procedures
-- =====================================================

DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DROP PROCEDURE IF EXISTS AddIndexIfNotExists;

-- =====================================================
-- STEP 12: Verification Queries
-- =====================================================
-- Run these to verify the migration

-- Check products table structure
-- DESCRIBE products;

-- Check sales table structure
-- DESCRIBE sales;

-- Check indexes on products
-- SHOW INDEXES FROM products;

-- Check indexes on sales
-- SHOW INDEXES FROM sales;

-- Verify new columns exist
-- SELECT 
--   COLUMN_NAME, 
--   DATA_TYPE, 
--   IS_NULLABLE, 
--   COLUMN_DEFAULT
-- FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'products'
--   AND COLUMN_NAME IN ('suppliers', 'price_per_piece', 'price_per_pack', 'variations')
-- ORDER BY COLUMN_NAME;

-- =====================================================
-- MIGRATION SUMMARY
-- =====================================================
-- 
-- Added Columns:
--   ✓ products.suppliers (JSON)
--   ✓ products.price_per_piece (DECIMAL)
--   ✓ products.price_per_pack (DECIMAL)
--   ✓ products.variations (JSON)
--   ✓ sales.bottle_deposit_total (DECIMAL)
--   ✓ sales.bottle_deposit_refunded (TINYINT)
--   ✓ expenses.category (VARCHAR)
--   ✓ expenses.payment_source (VARCHAR)
--   ✓ quantity_history.updated_at (TIMESTAMP)
--
-- Added Indexes:
--   ✓ products.idx_category
--   ✓ products.idx_skip_stock
--   ✓ products.idx_stock_low (composite)
--   ✓ sales.idx_payment_method
--   ✓ sales.idx_created_at
--   ✓ sales.idx_date_payment (composite)
--   ✓ sales.idx_bottle_deposit
--   ✓ store_funds.idx_category
--
-- =====================================================
-- END OF MIGRATION SCRIPT
-- =====================================================

