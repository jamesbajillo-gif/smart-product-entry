-- =====================================================
-- Smart Product Entry - Complete Database Setup SQL
-- =====================================================
-- This script creates all required tables and adds missing columns
-- Run this script directly in your MySQL database
-- =====================================================

-- =====================================================
-- 1. CREATE TABLES (if they don't exist)
-- =====================================================

-- Products Table
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

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  items JSON,
  total DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  amount_tendered DECIMAL(10,2),
  change_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quantity History Table
CREATE TABLE IF NOT EXISTS quantity_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL,
  quantities JSON,
  UNIQUE KEY unique_product (product_id)
);

-- Stock Adjustments Table
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

-- Expenses Table
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
-- 2. ADD MISSING COLUMNS (run only if columns don't exist)
-- =====================================================
-- Note: These ALTER TABLE statements will fail if columns already exist
-- Check your table structure first, or run them individually

-- Add missing columns to products table
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS skip_stock_tracking TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to sales table
ALTER TABLE sales 
  ADD COLUMN IF NOT EXISTS items JSON,
  ADD COLUMN IF NOT EXISTS amount_tendered DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS change_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to quantity_history table
-- (All columns are in CREATE TABLE, but if table exists without unique key)
ALTER TABLE quantity_history 
  ADD UNIQUE KEY IF NOT EXISTS unique_product (product_id);

-- Add missing columns to stock_adjustments table
ALTER TABLE stock_adjustments 
  ADD COLUMN IF NOT EXISTS reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supplier VARCHAR(255),
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD INDEX IF NOT EXISTS idx_product_id (product_id),
  ADD INDEX IF NOT EXISTS idx_created_at (created_at),
  ADD INDEX IF NOT EXISTS idx_supplier (supplier);

-- Add missing columns to expenses table
ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS supplier VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD INDEX IF NOT EXISTS idx_product_id (product_id),
  ADD INDEX IF NOT EXISTS idx_supplier (supplier),
  ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- =====================================================
-- 3. ALTERNATIVE: Safe Column Addition (MySQL 5.7+)
-- =====================================================
-- If your MySQL version doesn't support IF NOT EXISTS for ALTER TABLE,
-- use this stored procedure approach or check manually first

DELIMITER $$

-- Procedure to safely add column if it doesn't exist
DROP PROCEDURE IF EXISTS AddColumnIfNotExists$$
CREATE PROCEDURE AddColumnIfNotExists(
  IN tableName VARCHAR(255),
  IN columnName VARCHAR(255),
  IN columnDefinition TEXT
)
BEGIN
  DECLARE columnExists INT DEFAULT 0;
  
  SELECT COUNT(*) INTO columnExists
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = tableName
    AND COLUMN_NAME = columnName;
  
  IF columnExists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', columnName, ' ', columnDefinition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- Use the procedure to safely add columns
-- Products table
CALL AddColumnIfNotExists('products', 'category', 'VARCHAR(100)');
CALL AddColumnIfNotExists('products', 'image_url', 'TEXT');
CALL AddColumnIfNotExists('products', 'stock_quantity', 'INT DEFAULT 0');
CALL AddColumnIfNotExists('products', 'low_stock_threshold', 'INT DEFAULT 5');
CALL AddColumnIfNotExists('products', 'skip_stock_tracking', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('products', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

-- Sales table
CALL AddColumnIfNotExists('sales', 'items', 'JSON');
CALL AddColumnIfNotExists('sales', 'amount_tendered', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('sales', 'change_amount', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('sales', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

-- Stock adjustments table
CALL AddColumnIfNotExists('stock_adjustments', 'reason', 'VARCHAR(255)');
CALL AddColumnIfNotExists('stock_adjustments', 'supplier', 'VARCHAR(255)');
CALL AddColumnIfNotExists('stock_adjustments', 'unit_cost', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('stock_adjustments', 'total_cost', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('stock_adjustments', 'notes', 'TEXT');
CALL AddColumnIfNotExists('stock_adjustments', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

-- Expenses table
CALL AddColumnIfNotExists('expenses', 'supplier', 'VARCHAR(255)');
CALL AddColumnIfNotExists('expenses', 'notes', 'TEXT');
CALL AddColumnIfNotExists('expenses', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

-- Clean up the procedure
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- =====================================================
-- 4. VERIFY TABLES AND COLUMNS
-- =====================================================
-- Run these queries to verify the setup

-- List all tables
SHOW TABLES;

-- Check products table structure
DESCRIBE products;

-- Check sales table structure
DESCRIBE sales;

-- Check quantity_history table structure
DESCRIBE quantity_history;

-- Check stock_adjustments table structure
DESCRIBE stock_adjustments;

-- Check expenses table structure
DESCRIBE expenses;

-- =====================================================
-- END OF SETUP SCRIPT
-- =====================================================

