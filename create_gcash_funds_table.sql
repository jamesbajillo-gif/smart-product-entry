-- Create gcash_funds table for tracking GCash Credits and Cash
-- This table stores all GCash-related transactions including:
-- - Adding funds to Credits or Cash
-- - GCASH-IN transactions (customer pays cash, we send GCash)
-- - GCASH-OUT transactions (customer sends GCash, we give cash)

CREATE TABLE IF NOT EXISTS gcash_funds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type ENUM('add-credits', 'add-cash', 'gcash-in', 'gcash-out') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  service_charge DECIMAL(10,2) DEFAULT 0,
  credits_balance_after DECIMAL(10,2) NOT NULL,
  cash_balance_after DECIMAL(10,2) NOT NULL,
  notes TEXT,
  gcash_number VARCHAR(20),
  operator_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_created_at (created_at),
  INDEX idx_operator_name (operator_name)
);

-- Insert initial balances if needed (optional)
-- INSERT INTO gcash_funds (transaction_type, amount, credits_balance_after, cash_balance_after, notes, operator_name)
-- VALUES ('add-credits', 0, 0, 0, 'Initial balance', 'System');

