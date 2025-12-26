# Database Setup SQL Scripts

This directory contains SQL scripts to set up the database for the Smart Product Entry system.

## Which Script Should I Use?

### 1. **database_setup_simple.sql** (Recommended for New Databases)
- **Use this if:** You're setting up a fresh database or all tables are missing
- **What it does:** Creates all required tables with `CREATE TABLE IF NOT EXISTS`
- **Safe to run:** Yes, won't fail if tables already exist
- **Best for:** Quick setup, new installations

### 2. **database_setup_safe.sql** (Recommended for Existing Databases)
- **Use this if:** You have some tables but they might be missing columns
- **What it does:** 
  - Creates all tables if they don't exist
  - Safely adds missing columns using a stored procedure
- **Safe to run:** Yes, checks before adding columns
- **Best for:** Upgrading existing databases, adding missing columns

### 3. **database_setup.sql** (Comprehensive)
- **Use this if:** You want the full setup with all options
- **What it does:** Includes both table creation and column addition with multiple approaches
- **Safe to run:** Yes, but more complex
- **Best for:** Advanced users who want all options

### 4. **add_missing_columns.sql** (Manual Column Addition)
- **Use this if:** Tables exist but you need to manually add specific columns
- **What it does:** Provides commented ALTER TABLE statements
- **Safe to run:** Uncomment only the columns you need
- **Best for:** Selective column addition

## Quick Start

### For a New Database:
```sql
-- Run this file:
database_setup_simple.sql
```

### For an Existing Database:
```sql
-- Run this file:
database_setup_safe.sql
```

## Required Tables

The system requires these 5 tables:

1. **products** - Product catalog
2. **sales** - Sales transactions
3. **quantity_history** - Quantity tracking history
4. **stock_adjustments** - Stock change records
5. **expenses** - Expense records

## How to Run

### Option 1: MySQL Command Line
```bash
mysql -u your_username -p your_database < database_setup_simple.sql
```

### Option 2: MySQL Workbench / phpMyAdmin
1. Open the SQL file
2. Select your database
3. Execute the script

### Option 3: Direct SQL Query
1. Connect to your MySQL database
2. Copy and paste the SQL from the file
3. Execute

## Verification

After running the script, verify the setup:

```sql
-- List all tables
SHOW TABLES;

-- Check each table structure
DESCRIBE products;
DESCRIBE sales;
DESCRIBE quantity_history;
DESCRIBE stock_adjustments;
DESCRIBE expenses;
```

## Troubleshooting

### Error: "Table already exists"
- This is normal if tables already exist
- The `IF NOT EXISTS` clause prevents errors
- Continue with the script

### Error: "Column already exists"
- If using `database_setup_safe.sql`, this shouldn't happen
- If using manual ALTER statements, skip that column

### Error: "Unknown column type 'JSON'"
- Your MySQL version might be too old
- JSON type requires MySQL 5.7.8+ or MariaDB 10.2.7+
- Upgrade MySQL or use TEXT type instead

### Error: "Access denied"
- Check your database user permissions
- User needs CREATE, ALTER, and INDEX privileges

## Notes

- All scripts use `IF NOT EXISTS` for safety
- Indexes are created automatically with tables
- The `created_at` columns use `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- JSON columns require MySQL 5.7.8+ or MariaDB 10.2.7+

## Support

If you encounter issues:
1. Check your MySQL version: `SELECT VERSION();`
2. Verify table existence: `SHOW TABLES;`
3. Check column structure: `DESCRIBE table_name;`
4. Review error messages for specific issues

