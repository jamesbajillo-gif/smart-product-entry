-- =====================================================
-- Smart Product Entry - Simple Database Setup SQL
-- =====================================================
-- This script creates all required tables
-- Run this script directly in your MySQL database
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
-- VERIFICATION QUERIES (Optional - run to check)
-- =====================================================

-- SHOW TABLES;
-- DESCRIBE products;
-- DESCRIBE sales;
-- DESCRIBE quantity_history;
-- DESCRIBE stock_adjustments;
-- DESCRIBE expenses;

