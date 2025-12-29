-- =====================================================
-- Create Fees Table for Other Fees Management
-- =====================================================
-- This table stores different types of fees that can be
-- applied to transactions (service fee, timpla fee, etc.)
-- =====================================================

-- Create fees table
CREATE TABLE IF NOT EXISTS fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  fee_type ENUM('service_fee', 'timpla_fee', 'transaction_fee', 'bottle_deposit', 'other') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  is_percentage TINYINT(1) DEFAULT 0 COMMENT '0 = fixed amount, 1 = percentage',
  is_active TINYINT(1) DEFAULT 1,
  categories JSON DEFAULT NULL COMMENT 'Array of category names that this fee applies to. NULL means applies to all categories.',
  calculation_type ENUM('per_item', 'per_transaction') DEFAULT 'per_transaction' COMMENT 'per_item = fee applies to each matching item, per_transaction = fee applies once per transaction',
  description TEXT,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fee_type (fee_type),
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
);

-- Insert default fees
INSERT INTO fees (name, fee_type, amount, is_percentage, is_active, description) VALUES
('Service Fee', 'service_fee', 0.00, 0, 1, 'Standard service fee for transactions'),
('Timpla Fee', 'timpla_fee', 0.00, 0, 1, 'Timpla fee for transactions'),
('Transaction Fee', 'transaction_fee', 0.00, 0, 1, 'Transaction processing fee'),
('Bottle Deposit', 'bottle_deposit', 0.00, 0, 1, 'Bottle deposit fee')
ON DUPLICATE KEY UPDATE name=name;

