-- =====================================================
-- Smart Product Entry - Category Management with Parent Support
-- =====================================================
-- This script creates a categories table with hierarchical support
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

DELIMITER ;

-- =====================================================
-- STEP 1: Create categories table
-- =====================================================

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  parent_id INT DEFAULT NULL COMMENT 'ID of parent category (NULL for root categories)',
  is_parent TINYINT(1) DEFAULT 0 COMMENT '1 if this category can have children, 0 otherwise',
  display_order INT DEFAULT 0 COMMENT 'Order for display purposes',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent_id (parent_id),
  INDEX idx_is_parent (is_parent),
  INDEX idx_display_order (display_order),
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE KEY unique_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STEP 2: Migrate existing categories from products
-- =====================================================

-- Insert default categories (as root categories)
INSERT IGNORE INTO categories (name, is_parent, display_order) VALUES
  ('Beverages', 1, 1),
  ('Snacks', 1, 2),
  ('Meals', 1, 3),
  ('Desserts', 1, 4),
  ('Groceries', 1, 5),
  ('Household', 1, 6),
  ('Cigarettes', 0, 7),
  ('candies-promo', 0, 8),
  ('fruits', 0, 9),
  ('toys', 0, 10),
  ('Coffee', 0, 11),
  ('Cup Noodle', 0, 12),
  ('Other', 0, 99);

-- =====================================================
-- STEP 3: Clean up procedures
-- =====================================================

DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- =====================================================
-- STEP 4: Verification Queries
-- =====================================================

-- Check categories table structure
-- DESCRIBE categories;

-- View all categories with their hierarchy
-- SELECT 
--   c.id,
--   c.name,
--   c.parent_id,
--   p.name AS parent_name,
--   c.is_parent,
--   c.display_order
-- FROM categories c
-- LEFT JOIN categories p ON c.parent_id = p.id
-- ORDER BY c.display_order, c.name;

-- =====================================================
-- MIGRATION SUMMARY
-- =====================================================
-- 
-- Created Tables:
--   ✓ categories (with parent support)
--
-- Features:
--   ✓ Hierarchical category structure (parent-child relationships)
--   ✓ Parent flag (is_parent) to mark categories that can have children
--   ✓ Display order for custom sorting
--   ✓ Foreign key constraint to prevent orphaned categories
--   ✓ Unique constraint on category name
--
-- =====================================================
-- END OF MIGRATION SCRIPT
-- =====================================================

