-- Migration: Add repaidAmount field and update status enum for AdvanceSalaries table
-- Date: 2025-12-19
-- Description: Adds tracking for advance salary repayments

-- Step 1: Add repaidAmount column
ALTER TABLE AdvanceSalaries 
ADD COLUMN IF NOT EXISTS repaidAmount DECIMAL(12, 2) NOT NULL DEFAULT 0 
COMMENT 'Amount that has been repaid from salary deductions';

-- Step 2: Update status enum to include REPAID and PARTIALLY_REPAID
-- Note: This requires recreating the column in MySQL
ALTER TABLE AdvanceSalaries 
MODIFY COLUMN status ENUM('PENDING', 'APPROVED', 'REJECTED', 'REPAID', 'PARTIALLY_REPAID') 
NOT NULL DEFAULT 'PENDING';

-- Step 3: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_advance_status ON AdvanceSalaries(status);
CREATE INDEX IF NOT EXISTS idx_advance_user_status ON AdvanceSalaries(userId, status);

-- Verification queries
-- Check if the column was added successfully
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'AdvanceSalaries' 
AND COLUMN_NAME = 'repaidAmount';

-- Check the updated enum values
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'AdvanceSalaries' 
AND COLUMN_NAME = 'status';

-- Check existing data
SELECT 
    id,
    userId,
    amount,
    repaidAmount,
    status,
    salaryMonth
FROM AdvanceSalaries
ORDER BY createdAt DESC
LIMIT 10;
