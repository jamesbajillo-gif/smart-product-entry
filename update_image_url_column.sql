-- =====================================================
-- Update image_url column to support base64 data URLs
-- =====================================================
-- This script changes the image_url column from VARCHAR(500)
-- to TEXT to support base64 data URLs which can be very long
-- =====================================================

-- Update image_url column to TEXT (supports up to 65,535 characters)
ALTER TABLE products 
MODIFY COLUMN image_url TEXT;

-- Verify the change
-- DESCRIBE products;

