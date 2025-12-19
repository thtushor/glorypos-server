# Payroll Release with Validation - API Documentation

## Overview
The `releasePayrollWithValidation` service provides a secure way to release employee payroll with comprehensive validation against calculated payroll details. This ensures data integrity and prevents incorrect salary releases.

## Endpoint
```
POST /api/payroll/payroll/release-with-validation
```

## Authentication
Requires authentication token in the request header.

## Request Payload Structure

Based on your frontend payload format:

```javascript
{
  "userId": 123,                    // Employee's UserRole ID (required)
  "salaryMonth": "2025-01",         // Format: YYYY-MM (required)
  "baseSalary": 50000,              // Employee's base salary (required)
  "shopId": 456,                    // Shop/Admin ID (required)
  
  // Editable fields (optional - only include if > 0)
  "advanceAmount": 5000,            // Advance salary deduction for this month
  "bonusAmount": 3000,              // Bonus amount
  "bonusDescription": "Performance bonus",
  "fineAmount": 500,                // Fine amount
  "overtimeAmount": 2000,           // Overtime payment
  "otherDeduction": 100,            // Other deductions
  
  // Calculated fields (required)
  "loanDeduction": 1000,            // Auto-calculated from active loans
  "netPayableSalary": 48400,        // Final payable amount after all calculations
  "paidAmount": 48400,              // Amount actually paid (can be partial)
  
  // Calculation snapshot (required for validation)
  "calculationSnapshot": {
    "workingDays": 26,
    "presentDays": 24,
    "paidLeaveDays": 1,
    "unpaidLeaveDays": 1,
    "perDaySalary": 1923.08,
    "unpaidLeaveDeduction": 1923.08,
    
    "advance": {
      "totalTaken": 10000,
      "totalRepaidBefore": 5000,
      "deductedThisMonth": 5000,
      "remaining": 0
    },
    
    "commission": {              // Only if sales exist
      "totalSales": 100000,
      "commissionRate": "2%",
      "commissionAmount": 2000
    },
    
    "salaryBreakdown": {
      "gross": 55000,
      "totalDeductions": 6600,
      "netPayable": 48400,
      "paid": 48400,
      "due": 0
    }
  }
}
```

## Validation Rules

The service performs the following validations:

### 0. **Multiple Releases Per Month** ⭐ NEW
- **Multiple releases allowed** for the same user and month
- Tracks total paid amount across all releases
- **Prevents over-payment**: Total paid amount (across all releases) cannot exceed net payable salary
- **Error if fully paid**: Cannot create new release if salary is already fully paid
- **Partial payment validation**: Each payment must not exceed remaining due amount

**Example:**
```javascript
// First release: Pay 30,000 out of 50,000
Release 1: paidAmount = 30,000, netPayable = 50,000 ✅ Success

// Second release: Pay remaining 20,000
Release 2: paidAmount = 20,000, netPayable = 50,000 ✅ Success
// Total paid = 50,000 (fully paid)

// Third release attempt: Salary already fully paid
Release 3: paidAmount = 5,000, netPayable = 50,000 ❌ Error
// "Salary already fully paid for user X in 2025-01. Total paid: 50000.00, Net payable: 50000"
```

### 1. **Base Salary Validation**
- Must match exactly with the employee's current base salary
- Tolerance: ±0.01

### 2. **Commission Validation**
- Must match the calculated commission from sales records
- Not editable by user
- Tolerance: ±0.01

### 3. **Loan Deduction Validation**
- Must match the calculated loan EMI from active loans
- Auto-calculated based on employee's active loan
- Tolerance: ±0.01

### 4. **Unpaid Leave Deduction Validation**
- Must match the calculated deduction based on attendance records
- Formula: `(unpaidLeaveDays / totalWorkingDays) * baseSalary`
- Tolerance: ±0.01

### 5. **Advance Amount Validation**
- Must be ≤ outstanding advance balance
- Editable field (user can choose partial deduction)
- Must be ≥ 0

### 6. **Fine Amount Validation**
- Editable field (allows override)
- Warns if different from calculated value
- Must be ≥ 0

### 7. **Net Payable Salary Validation**
- Must match calculated value:
  ```
  Gross = baseSalary + commission + bonus + overtime
  Deductions = unpaidLeaveDeduction + advanceAmount + fineAmount + loanDeduction + otherDeduction
  NetPayable = Gross - Deductions
  ```
- Tolerance: ±0.01

### 8. **Paid Amount Validation**
- Must be ≤ netPayableSalary
- Must be ≥ 0
- Allows partial payment

## Response Format

### Success Response (201)
```javascript
{
  "status": true,
  "message": "Payroll released successfully with validation",
  "data": {
    "id": 789,
    "userId": 123,
    "salaryMonth": "2025-01",
    "baseSalary": 50000,
    "advanceAmount": 5000,
    "bonusAmount": 3000,
    "bonusDescription": "Performance bonus",
    "loanDeduction": 1000,
    "fineAmount": 500,
    "overtimeAmount": 2000,
    "otherDeduction": 100,
    "netPayableSalary": 48400,
    "paidAmount": 48400,
    "shopId": 456,
    "status": "RELEASED",        // "PENDING" if dueAmount > 0
    "releaseDate": "2025-01-15T10:30:00Z",
    "releasedBy": 456,
    "calculationSnapshot": { ... },
    "dueAmount": 0,
    "validationPassed": true,
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}
```

### Error Response (400)
```javascript
{
  "status": false,
  "message": "Base salary mismatch. Expected: 50000, Received: 45000",
  "validationPassed": false
}
```

## Common Error Messages

1. **"Missing required fields: userId, salaryMonth, or shopId"**
   - Ensure all required fields are provided

2. **"Salary already fully paid for user {userId} in {salaryMonth}. Total paid: X, Net payable: Y"** ⭐ NEW
   - Attempting to create a new release when salary is already fully paid
   - Check existing releases before attempting new payment

3. **"Total paid amount (X) exceeds net payable salary (Y). Already paid: Z, Attempting to pay: W"** ⭐ NEW
   - The sum of all payments (including this one) would exceed the net payable salary
   - Reduce the payment amount to not exceed remaining due

4. **"Payment amount (X) exceeds remaining due amount (Y)"** ⭐ NEW
   - This specific payment exceeds what's still owed
   - Maximum payment allowed is the remaining due amount

5. **"Base salary mismatch. Expected: X, Received: Y"**
   - Base salary doesn't match employee's current salary

6. **"Commission mismatch. Expected: X, Received: Y"**
   - Commission calculation doesn't match sales records

7. **"Loan deduction mismatch. Expected: X, Received: Y"**
   - Loan deduction doesn't match active loan EMI

8. **"Unpaid leave deduction mismatch. Expected: X, Received: Y"**
   - Leave deduction doesn't match attendance records

9. **"Advance deduction (X) exceeds outstanding advance (Y)"**
   - Trying to deduct more than available advance balance

10. **"Net payable salary mismatch. Expected: X, Received: Y"**
    - Calculation error in net payable amount

11. **"Paid amount (X) cannot exceed net payable salary (Y)"**
    - Trying to pay more than the calculated net payable (single release)

12. **"Paid amount cannot be negative"**
    - Invalid paid amount

## Side Effects

When payroll is successfully released, the following actions occur:

### 1. **Loan Balance Update**
- If `loanDeduction > 0`:
  - Reduces the employee's active loan `remainingBalance`
  - Creates a `LoanPayment` record
  - Marks loan as "COMPLETED" if fully paid

### 2. **Advance Salary Update**
- If `advanceAmount > 0`:
  - Marks advance salary records as "REPAID" or "PARTIALLY_REPAID"
  - Uses FIFO (First In First Out) approach
  - Updates `repaidAmount` for each advance record

### 3. **Payroll Status**
- Status set to "RELEASED" if `paidAmount === netPayableSalary`
- Status set to "PENDING" if `dueAmount > 0` (partial payment)

## Frontend Integration Example

```javascript
const handleReleaseSalary = async () => {
  // Calculate values from payrollDetails
  const totalDeductions =
    editableLeaveDeduction +
    editableAdvanceDeduction +
    editableFine +
    (payrollDetails.loanDeduction || 0) +
    (payrollDetails.otherDeduction || 0);

  const grossSalary =
    payrollDetails.baseSalary +
    payrollDetails.totalCommission +
    editableBonus +
    editableOvertime;

  const dueAmount = editableNetPayable - editablePaidAmount;

  const payload = {
    userId: payrollDetails.userId,
    salaryMonth: month,
    baseSalary: payrollDetails.baseSalary,
    shopId: user?.id,

    // Only include if values exist
    ...(editableAdvanceDeduction > 0 && { advanceAmount: editableAdvanceDeduction }),
    ...(editableBonus > 0 && { bonusAmount: editableBonus }),
    ...(editableBonusDescription && { bonusDescription: editableBonusDescription }),
    ...(payrollDetails.loanDeduction > 0 && { loanDeduction: payrollDetails.loanDeduction }),
    ...(editableFine > 0 && { fineAmount: editableFine }),
    ...(editableOvertime > 0 && { overtimeAmount: editableOvertime }),
    ...(payrollDetails.otherDeduction > 0 && { otherDeduction: payrollDetails.otherDeduction }),

    netPayableSalary: editableNetPayable,
    paidAmount: editablePaidAmount,

    calculationSnapshot: {
      workingDays: payrollDetails.totalWorkingDays,
      presentDays: payrollDetails.totalWorkingDays - payrollDetails.totalUnpaidLeaveDays,
      paidLeaveDays: payrollDetails.totalPaidLeaveDays,
      unpaidLeaveDays: payrollDetails.totalUnpaidLeaveDays,
      perDaySalary: payrollDetails.baseSalary / payrollDetails.totalWorkingDays,
      unpaidLeaveDeduction: editableLeaveDeduction,

      advance: {
        totalTaken: payrollDetails.totalAdvanceTaken,
        totalRepaidBefore: payrollDetails.totalAdvanceRepaid,
        deductedThisMonth: editableAdvanceDeduction,
        remaining: payrollDetails.outstandingAdvance - editableAdvanceDeduction,
      },

      ...(payrollDetails.totalSales > 0 && {
        commission: {
          totalSales: payrollDetails.totalSales,
          commissionRate: payrollDetails.calculationSnapshot?.commissionData?.commissionRecords?.[0]?.commissionPercentage || "0%",
          commissionAmount: payrollDetails.totalCommission,
        }
      }),

      salaryBreakdown: {
        gross: grossSalary,
        totalDeductions: totalDeductions,
        netPayable: editableNetPayable,
        paid: editablePaidAmount,
        due: dueAmount,
      }
    }
  };

  try {
    const response = await fetch('/api/payroll/payroll/release-with-validation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.status) {
      console.log('Payroll released successfully:', result.data);
      // Handle success (close modal, refresh list, etc.)
    } else {
      console.error('Validation failed:', result.message);
      // Show error to user
    }
  } catch (error) {
    console.error('API call failed:', error);
  }
};
```

## Best Practices

1. **Always fetch fresh payroll details** before releasing salary
2. **Validate on frontend** before sending to API (for better UX)
3. **Handle partial payments** by setting `paidAmount < netPayableSalary`
4. **Check validation errors** and display them clearly to users
5. **Log payload** for debugging (as shown in your code)
6. **Use transactions** - the service automatically handles rollback on errors

## Database Changes Required

If you haven't already, you need to add the `repaidAmount` field to the `AdvanceSalaries` table:

```sql
ALTER TABLE AdvanceSalaries 
ADD COLUMN repaidAmount DECIMAL(12, 2) NOT NULL DEFAULT 0 
COMMENT 'Amount that has been repaid from salary deductions';

ALTER TABLE AdvanceSalaries 
MODIFY COLUMN status ENUM('PENDING', 'APPROVED', 'REJECTED', 'REPAID', 'PARTIALLY_REPAID') 
NOT NULL DEFAULT 'PENDING';
```

## Notes

- The service uses the existing `calculateMonthlyPayrollDetails` function to validate all non-editable fields
- All monetary calculations use a tolerance of ±0.01 to handle floating-point precision
- The service automatically handles loan and advance salary updates in a transaction
- If any validation fails, the entire transaction is rolled back
