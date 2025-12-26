-- =====================================================
-- Add Missing Columns to Existing Tables
-- =====================================================
-- Run this ONLY if tables already exist but are missing columns
-- Check table structure first with: DESCRIBE table_name;
-- =====================================================

-- Add missing columns to products table (if needed)
-- Uncomment and run only the columns that are missing

-- ALTER TABLE products ADD COLUMN category VARCHAR(100);
-- ALTER TABLE products ADD COLUMN image_url TEXT;
-- ALTER TABLE products ADD COLUMN stock_quantity INT DEFAULT 0;
-- ALTER TABLE products ADD COLUMN low_stock_threshold INT DEFAULT 5;
-- ALTER TABLE products ADD COLUMN skip_stock_tracking TINYINT(1) DEFAULT 0;
-- ALTER TABLE products ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to sales table (if needed)
-- ALTER TABLE sales ADD COLUMN items JSON;
-- ALTER TABLE sales ADD COLUMN amount_tendered DECIMAL(10,2);
-- ALTER TABLE sales ADD COLUMN change_amount DECIMAL(10,2);
-- ALTER TABLE sales ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to stock_adjustments table (if needed)
-- ALTER TABLE stock_adjustments ADD COLUMN reason VARCHAR(255);
-- ALTER TABLE stock_adjustments ADD COLUMN supplier VARCHAR(255);
-- ALTER TABLE stock_adjustments ADD COLUMN unit_cost DECIMAL(10,2);
-- ALTER TABLE stock_adjustments ADD COLUMN total_cost DECIMAL(10,2);
-- ALTER TABLE stock_adjustments ADD COLUMN notes TEXT;
-- ALTER TABLE stock_adjustments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE stock_adjustments ADD INDEX idx_product_id (product_id);
-- ALTER TABLE stock_adjustments ADD INDEX idx_created_at (created_at);
-- ALTER TABLE stock_adjustments ADD INDEX idx_supplier (supplier);

-- Add missing columns to expenses table (if needed)
-- ALTER TABLE expenses ADD COLUMN supplier VARCHAR(255);
-- ALTER TABLE expenses ADD COLUMN notes TEXT;
-- ALTER TABLE expenses ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE expenses ADD INDEX idx_product_id (product_id);
-- ALTER TABLE expenses ADD INDEX idx_supplier (supplier);
-- ALTER TABLE expenses ADD INDEX idx_created_at (created_at);

-- Add unique key to quantity_history (if needed)
-- ALTER TABLE quantity_history ADD UNIQUE KEY unique_product (product_id);

