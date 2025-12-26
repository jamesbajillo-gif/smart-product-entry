-- =====================================================
-- Add Variations Column to Products Table
-- =====================================================
-- This script adds a 'variations' JSON column to store
-- price variations for products
-- =====================================================

-- Add variations column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variations JSON DEFAULT NULL;

-- Note: Variations will be stored as JSON array:
-- [
--   {
--     "id": "unique-id",
--     "name": "Variation Name",
--     "price": 10.00,
--     "stock_quantity": 0
--   }
-- ]

