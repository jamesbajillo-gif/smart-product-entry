-- =====================================================
-- Smart Product Entry - Safe Database Setup SQL
-- =====================================================
-- This script safely creates tables and adds missing columns
-- Works with MySQL 5.7+ and MariaDB 10.2+
-- =====================================================

-- =====================================================
-- STEP 1: Create all tables (safe - won't fail if exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  image_url TEXT,
  stock_quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  skip_stock_tracking TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  items JSON,
  total DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  amount_tendered DECIMAL(10,2),
  change_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quantity_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL,
  quantities JSON,
  UNIQUE KEY unique_product (product_id)
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL,
  adjustment_type ENUM('add', 'remove', 'set', 'sale') NOT NULL,
  quantity_change INT NOT NULL,
  previous_quantity INT NOT NULL,
  new_quantity INT NOT NULL,
  reason VARCHAR(255),
  supplier VARCHAR(255),
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id),
  INDEX idx_created_at (created_at),
  INDEX idx_supplier (supplier)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  supplier VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id),
  INDEX idx_supplier (supplier),
  INDEX idx_created_at (created_at)
);

-- =====================================================
-- STEP 2: Create procedure to safely add columns
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
    SELECT CONCAT('Added column ', p_column_name, ' to table ', p_table_name) AS result;
  ELSE
    SELECT CONCAT('Column ', p_column_name, ' already exists in table ', p_table_name) AS result;
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- STEP 3: Add missing columns to products table
-- =====================================================

CALL AddColumnIfNotExists('products', 'category', 'VARCHAR(100)');
CALL AddColumnIfNotExists('products', 'image_url', 'TEXT');
CALL AddColumnIfNotExists('products', 'stock_quantity', 'INT DEFAULT 0');
CALL AddColumnIfNotExists('products', 'low_stock_threshold', 'INT DEFAULT 5');
CALL AddColumnIfNotExists('products', 'skip_stock_tracking', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('products', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

-- =====================================================
-- STEP 4: Add missing columns to sales table
-- =====================================================

CALL AddColumnIfNotExists('sales', 'items', 'JSON');
CALL AddColumnIfNotExists('sales', 'amount_tendered', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('sales', 'change_amount', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('sales', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

-- =====================================================
-- STEP 5: Add missing columns to stock_adjustments table
-- =====================================================

CALL AddColumnIfNotExists('stock_adjustments', 'reason', 'VARCHAR(255)');
CALL AddColumnIfNotExists('stock_adjustments', 'supplier', 'VARCHAR(255)');
CALL AddColumnIfNotExists('stock_adjustments', 'unit_cost', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('stock_adjustments', 'total_cost', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('stock_adjustments', 'notes', 'TEXT');
CALL AddColumnIfNotExists('stock_adjustments', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

-- Add indexes if they don't exist (check manually - MySQL doesn't have IF NOT EXISTS for indexes)
-- Run these only if indexes are missing:
-- ALTER TABLE stock_adjustments ADD INDEX idx_product_id (product_id);
-- ALTER TABLE stock_adjustments ADD INDEX idx_created_at (created_at);
-- ALTER TABLE stock_adjustments ADD INDEX idx_supplier (supplier);

-- =====================================================
-- STEP 6: Add missing columns to expenses table
-- =====================================================

CALL AddColumnIfNotExists('expenses', 'supplier', 'VARCHAR(255)');
CALL AddColumnIfNotExists('expenses', 'notes', 'TEXT');
CALL AddColumnIfNotExists('expenses', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

-- Add indexes if they don't exist (check manually):
-- ALTER TABLE expenses ADD INDEX idx_product_id (product_id);
-- ALTER TABLE expenses ADD INDEX idx_supplier (supplier);
-- ALTER TABLE expenses ADD INDEX idx_created_at (created_at);

-- =====================================================
-- STEP 7: Clean up procedure
-- =====================================================

DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- =====================================================
-- VERIFICATION (Optional)
-- =====================================================

-- Show all tables
-- SHOW TABLES;

-- Check each table structure
-- DESCRIBE products;
-- DESCRIBE sales;
-- DESCRIBE quantity_history;
-- DESCRIBE stock_adjustments;
-- DESCRIBE expenses;

-- =====================================================
-- END OF SCRIPT
-- =====================================================

