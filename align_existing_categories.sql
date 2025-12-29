-- =====================================================
-- Smart Product Entry - Align Existing Categories
-- =====================================================
-- This script ensures all categories from products table
-- are properly migrated to the categories table
-- Works with MySQL 5.7+ and MariaDB 10.2+
-- =====================================================

-- =====================================================
-- STEP 1: Ensure categories table exists
-- =====================================================
-- Run create_category_management.sql first if not already done

-- =====================================================
-- STEP 2: Migrate all unique categories from products table
-- =====================================================

-- Insert all unique categories from products table that don't exist in categories table
INSERT IGNORE INTO categories (name, is_parent, display_order)
SELECT DISTINCT 
  category,
  0 AS is_parent,
  999 AS display_order
FROM products
WHERE category IS NOT NULL 
  AND category != ''
  AND category NOT IN (
    SELECT name FROM categories
  )
ORDER BY category;

-- =====================================================
-- STEP 3: Update display order for default categories
-- =====================================================

-- Set proper display order for known parent categories
UPDATE categories 
SET is_parent = 1, display_order = 1 
WHERE name = 'Beverages';

UPDATE categories 
SET is_parent = 1, display_order = 2 
WHERE name = 'Snacks';

UPDATE categories 
SET is_parent = 1, display_order = 3 
WHERE name = 'Meals';

UPDATE categories 
SET is_parent = 1, display_order = 4 
WHERE name = 'Desserts';

UPDATE categories 
SET is_parent = 1, display_order = 5 
WHERE name = 'Groceries';

UPDATE categories 
SET is_parent = 1, display_order = 6 
WHERE name = 'Household';

-- Set display order for known leaf categories
UPDATE categories 
SET is_parent = 0, display_order = 7 
WHERE name = 'Cigarettes';

UPDATE categories 
SET is_parent = 0, display_order = 8 
WHERE name = 'candies-promo';

UPDATE categories 
SET is_parent = 0, display_order = 9 
WHERE name = 'fruits';

UPDATE categories 
SET is_parent = 0, display_order = 10 
WHERE name = 'toys';

UPDATE categories 
SET is_parent = 0, display_order = 11 
WHERE name = 'Coffee';

UPDATE categories 
SET is_parent = 0, display_order = 12 
WHERE name = 'Cup Noodle';

UPDATE categories 
SET is_parent = 0, display_order = 99 
WHERE name = 'Other';

-- =====================================================
-- STEP 4: Suggest logical parent-child relationships
-- =====================================================

-- Example: Move "Coffee" under "Beverages" if it exists
UPDATE categories c1
SET parent_id = (SELECT id FROM categories WHERE name = 'Beverages' LIMIT 1)
WHERE c1.name = 'Coffee'
  AND EXISTS (SELECT 1 FROM categories WHERE name = 'Beverages')
  AND c1.parent_id IS NULL;

-- Example: Move "Cup Noodle" under "Meals" if it exists
UPDATE categories c1
SET parent_id = (SELECT id FROM categories WHERE name = 'Meals' LIMIT 1)
WHERE c1.name = 'Cup Noodle'
  AND EXISTS (SELECT 1 FROM categories WHERE name = 'Meals')
  AND c1.parent_id IS NULL;

-- Example: Move "fruits" under "Groceries" if it exists
UPDATE categories c1
SET parent_id = (SELECT id FROM categories WHERE name = 'Groceries' LIMIT 1)
WHERE c1.name = 'fruits'
  AND EXISTS (SELECT 1 FROM categories WHERE name = 'Groceries')
  AND c1.parent_id IS NULL;

-- Example: Move "candies-promo" under "Snacks" if it exists
UPDATE categories c1
SET parent_id = (SELECT id FROM categories WHERE name = 'Snacks' LIMIT 1)
WHERE c1.name = 'candies-promo'
  AND EXISTS (SELECT 1 FROM categories WHERE name = 'Snacks')
  AND c1.parent_id IS NULL;

-- =====================================================
-- STEP 5: Verification Queries
-- =====================================================

-- Check for categories in products that don't exist in categories table
-- SELECT DISTINCT p.category
-- FROM products p
-- WHERE p.category IS NOT NULL 
--   AND p.category != ''
--   AND p.category NOT IN (SELECT name FROM categories);

-- View all categories with their hierarchy
-- SELECT 
--   c.id,
--   c.name,
--   c.parent_id,
--   p.name AS parent_name,
--   c.is_parent,
--   c.display_order,
--   (SELECT COUNT(*) FROM products WHERE category = c.name) AS product_count
-- FROM categories c
-- LEFT JOIN categories p ON c.parent_id = p.id
-- ORDER BY c.display_order, c.name;

-- View orphaned categories (categories not used by any products)
-- SELECT c.id, c.name, c.is_parent
-- FROM categories c
-- WHERE NOT EXISTS (
--   SELECT 1 FROM products p WHERE p.category = c.name
-- )
-- ORDER BY c.name;

-- =====================================================
-- ALIGNMENT SUMMARY
-- =====================================================
-- 
-- This script:
--   ✓ Migrates all unique categories from products table
--   ✓ Sets proper display order for known categories
--   ✓ Suggests logical parent-child relationships:
--     - Coffee → under Beverages
--     - Cup Noodle → under Meals
--     - fruits → under Groceries
--     - candies-promo → under Snacks
--   ✓ Ensures all product categories exist in categories table
--
-- After running this script:
--   1. Review the suggested parent-child relationships
--   2. Use Category Management UI to adjust as needed
--   3. Verify all products have valid categories
--
-- =====================================================
-- END OF ALIGNMENT SCRIPT
-- =====================================================

