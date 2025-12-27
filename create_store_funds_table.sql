-- Create store_funds table for tracking store operating funds
-- This is separate from sales and tracks cash flow for the store

CREATE TABLE IF NOT EXISTS store_funds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type ENUM('add', 'withdraw', 'expense', 'income') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  notes TEXT,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_created_at (created_at)
);

