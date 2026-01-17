# Salary Frequency Implementation - Updated

## Overview
Updated the payroll system to support three different salary frequency types with precise calculation rules:

## Salary Calculation Rules

### 1. **Daily Salary**
- `baseSalary` = **daily rate** (amount per working day)
- **Formula**: `salary = dailyRate × workingDays`
- **Working Days**: Count from payroll start (joining date or month start, whichever is later) to month end
- **Excludes**: Weekend days (configured in `WEEKEND_DAYS`)
- **Absence Deduction**: `dailyRate × unpaidLeaveDays`

**Example:**
```
Daily Rate: 500 BDT/day
Payroll Period: Jan 1-31, 2026 (31 days)
Weekends: Friday & Saturday
Working Days: 22 days
Unpaid Leave: 2 days

Gross Salary = 500 × 22 = 11,000 BDT
Absence Deduction = 500 × 2 = 1,000 BDT
Net Salary = 11,000 - 1,000 = 10,000 BDT
```

### 2. **Weekly Salary**
- `baseSalary` = **weekly rate** (amount per Saturday-Friday week)
- **Formula**: `salary = weeklyRate × completeWeeks`
- **Complete Week**: Saturday to Friday (7 consecutive days)
- **Partial Weeks**: NOT PAID - carried to next payroll period
- **Week Counting**: Starts from first Saturday on or after payroll start date
- **Absence Deduction**: `(weeklyRate / 7) × unpaidLeaveDays`

**Important Rules:**
- Only complete Saturday-Friday weeks are paid
- Days before the first complete week are not paid
- Partial week at month end carries to next month
- No pro-rating for partial weeks

**Example:**
```
Weekly Rate: 3,500 BDT/week
Payroll Period: Jan 1-31, 2026

Week 1: Jan 4 (Sat) - Jan 10 (Fri) ✓ Complete
Week 2: Jan 11 (Sat) - Jan 17 (Fri) ✓ Complete
Week 3: Jan 18 (Sat) - Jan 24 (Fri) ✓ Complete
Week 4: Jan 25 (Sat) - Jan 31 (Fri) ✗ Partial (only 7 days, but Jan 31 is Friday)

Actually, if Jan 31 is Friday:
Week 4: Jan 25 (Sat) - Jan 31 (Fri) ✓ Complete

Complete Weeks: 4
Gross Salary = 3,500 × 4 = 14,000 BDT

If employee had 1 unpaid leave day:
Absence Deduction = (3,500 / 7) × 1 = 500 BDT
Net Salary = 14,000 - 500 = 13,500 BDT
```

### 3. **Monthly Salary**
- `baseSalary` = **fixed monthly amount**
- **Formula**: `salary = monthlyRate` (no calculation)
- **Absence Deduction**: `(monthlyRate / workingDays) × unpaidLeaveDays`

**Example:**
```
Monthly Rate: 15,000 BDT/month
Working Days in Month: 22 days
Unpaid Leave: 2 days

Gross Salary = 15,000 BDT
Absence Deduction = (15,000 / 22) × 2 = 1,363.64 BDT
Net Salary = 15,000 - 1,363.64 = 13,636.36 BDT
```

## Implementation Details

### Changes Made

#### 1. `calculateSalaryByFrequency` Function
New signature:
```javascript
async calculateSalaryByFrequency(
  salaryFrequency,  // 'daily', 'weekly', or 'monthly'
  baseSalary,       // Rate amount
  salaryMonth,      // 'YYYY-MM'
  userId,           // Employee ID
  joiningDate       // Employee joining date
)
```

**Daily Calculation:**
- Determines payroll start: `max(monthStart, joiningDate)`
- Counts working days (excludes weekends)
- Returns: `dailyRate × workingDays`

**Weekly Calculation:**
- Finds first Saturday on or after payroll start
- Counts only complete Saturday-Friday weeks
- Tracks partial weeks and days before first week
- Returns: `weeklyRate × completeWeeks`
- Provides detailed week breakdown

**Monthly Calculation:**
- Returns fixed `baseSalary`
- No day/week calculation

#### 2. `calculateMonthlyPayrollDetails` Function
Updated logic:
1. Fetches employee with `salaryFrequency`
2. Calls `calculateSalaryByFrequency` for daily/weekly
3. Uses fixed amount for monthly
4. Calculates gross: `baseSalary + commission + bonus`
5. Applies absence deduction based on frequency type
6. Subtracts advance salary, loans, fines, other deductions

### Response Structure

```javascript
{
  userId: 123,
  fullName: "John Doe",
  salaryMonth: "2026-01",
  baseSalary: 500,              // Daily/weekly/monthly rate
  effectiveBaseSalary: 11000,   // Calculated amount
  salaryFrequency: "daily",
  
  salaryCalculationDetails: {
    // For daily:
    dailyRate: 500.00,
    payrollStartDate: "2026-01-01",
    payrollEndDate: "2026-01-31",
    totalDaysInMonth: 31,
    workingDays: 22,
    calculatedSalary: 11000
    
    // For weekly:
    weeklyRate: 3500.00,
    payrollStartDate: "2026-01-01",
    payrollEndDate: "2026-01-31",
    firstWeekStartDate: "2026-01-04",
    completeWeeks: 4,
    daysBeforeFirstWeek: 3,
    partialWeekDays: 0,
    weekDetails: [
      {
        weekNumber: 1,
        startDate: "2026-01-04",
        endDate: "2026-01-10",
        status: "complete"
      },
      // ... more weeks
    ],
    calculatedSalary: 14000,
    note: null
    
    // For monthly:
    monthlyRate: 15000.00,
    payrollStartDate: "2026-01-01",
    payrollEndDate: "2026-01-31",
    note: "Fixed monthly salary"
  },
  
  // Attendance
  totalWorkingDays: 22,
  totalUnpaidLeaveDays: 2,
  unpaidLeaveDeductionAmount: 1000.00,
  
  // Gross & Deductions
  grossSalary: 11000,
  totalCommission: 500,
  bonusAmount: 1000,
  netAttendanceSalary: 10000,
  
  // Other deductions
  advanceAmount: 500,
  loanDeduction: 200,
  fineAmount: 100,
  otherDeduction: 0,
  
  // Final
  netPayableSalary: 9200
}
```

## Joining Month Handling

All frequency types automatically handle joining month:

- **Payroll Start Date** = `max(monthStart, joiningDate)`
- **Daily**: Counts only working days from joining date
- **Weekly**: Starts week counting from first Saturday after joining
- **Monthly**: Fixed amount (no pro-rating)

## Weekend Configuration

Set in `.env`:
```
WEEKEND_DAYS=5,6
```
Where: 0=Sunday, 1=Monday, ..., 6=Saturday

## Key Differences from Previous Version

| Aspect | Old Logic | New Logic |
|--------|-----------|-----------|
| Daily | Based on attendance records | Based on working days count |
| Weekly | Based on presence in week | Complete weeks only, no partial |
| Monthly | Pro-rated for joining month | Fixed amount always |
| Absence | Deducted in calculation | Deducted after gross calculation |
| Partial Weeks | Pro-rated | Carried to next period |

## Testing Scenarios

### Daily Salary
1. ✅ Full month with no absences
2. ✅ Joining mid-month
3. ✅ With unpaid leave days
4. ✅ Month with different day counts (28, 30, 31)

### Weekly Salary
1. ✅ Month starting on Saturday
2. ✅ Month starting mid-week (partial first week)
3. ✅ Month ending mid-week (partial last week)
4. ✅ Joining mid-month
5. ✅ With unpaid leave days

### Monthly Salary
1. ✅ Full month
2. ✅ With unpaid leave days
3. ✅ Joining month (no pro-rating)

## Migration Notes

- Existing employees default to `salaryFrequency = 'monthly'`
- Update `UserRole` records to set appropriate frequency
- `baseSalary` meaning changes based on frequency:
  - Daily: per-day rate
  - Weekly: per-week rate
  - Monthly: per-month amount
