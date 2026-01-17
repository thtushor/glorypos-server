# Salary Frequency Implementation

## Overview
Updated the payroll system to support three different salary frequency types: **Daily**, **Weekly**, and **Monthly**.

## Changes Made

### 1. UserRole Entity (`api/entity/UserRole.js`)
- Already has `salaryFrequency` field with ENUM values: `'daily'`, `'weekly'`, `'monthly'`
- Default value: `'monthly'`

### 2. PayrollService (`api/services/PayrollService.js`)

#### A. Updated `fetchEmployeeBaseSalary` function
- Added `salaryFrequency` to the attributes fetched from UserRole
- Returns `salaryFrequency` along with other employee details

#### B. New Helper Function: `calculateSalaryByFrequency`
This async function calculates salary based on the frequency type:

**Daily Salary:**
- `baseSalary` represents the **daily rate**
- Counts actual present days from attendance records
- Formula: `salary = dailyRate × presentDays`
- Handles half-day attendance (counts as 0.5 days)
- Excludes weekend days (configured in `WEEKEND_DAYS` env variable)
- If no attendance record exists for a working day, assumes present

**Weekly Salary:**
- `baseSalary` represents the **weekly rate**
- Counts complete weeks (Saturday to Friday cycles)
- Formula: `salary = weeklyRate × presentWeeks`
- A week is counted as "present" if employee was present for at least one day in that week
- Handles half-day attendance
- Excludes weekend days

**Monthly Salary:**
- `baseSalary` represents the **monthly rate**
- Keeps the original logic with unpaid leave deductions
- For joining month: pro-rates based on days worked

#### C. Updated `calculateMonthlyPayrollDetails` function
Main changes:
1. Extracts `salaryFrequency` from employee data
2. Calls `calculateSalaryByFrequency` for daily and weekly frequencies
3. Applies special handling for joining month:
   - **Daily**: Limits present days to actual days worked from joining date
   - **Weekly**: Calculates weeks from joining date
   - **Monthly**: Pro-rates salary based on days worked (existing logic)
4. For **monthly** frequency (non-joining month), applies unpaid leave deduction
5. For **daily** and **weekly**, deduction is already applied in the calculation
6. Returns `salaryFrequency` and `salaryCalculationDetails` in response

### 3. Response Data Structure
The payroll calculation now includes:
```javascript
{
  // ... existing fields ...
  salaryFrequency: "daily" | "weekly" | "monthly",
  salaryCalculationDetails: {
    // For daily:
    dailyRate: 500.00,
    totalDaysInMonth: 31,
    presentDays: 22.5,
    calculatedSalary: 11250,
    
    // For weekly:
    weeklyRate: 3500.00,
    totalWeeks: 5,
    presentWeeks: 4,
    calculatedSalary: 14000,
    
    // For monthly:
    monthlyRate: 15000.00,
    unpaidLeaveDeduction: 500.00 // if applicable
  }
}
```

## How It Works

### Daily Salary Example
- Employee has daily rate: **500 BDT/day**
- Month: January 2026 (31 days)
- Weekend days: Friday & Saturday
- Working days: 22 days
- Present: 20 full days + 1 half day = 20.5 days
- **Salary = 500 × 20.5 = 10,250 BDT**

### Weekly Salary Example
- Employee has weekly rate: **3,500 BDT/week**
- Month: January 2026
- Week 1 (Sat-Fri): Present 3 days → Counts as 1 week
- Week 2 (Sat-Fri): Present 5 days → Counts as 1 week
- Week 3 (Sat-Fri): Absent all days → Counts as 0 weeks
- Week 4 (Sat-Fri): Present 2 days → Counts as 1 week
- Week 5 (Sat-Fri): Present 1 day → Counts as 1 week
- **Salary = 3,500 × 4 = 14,000 BDT**

### Monthly Salary Example
- Employee has monthly rate: **15,000 BDT/month**
- Unpaid leave: 2 days out of 22 working days
- Deduction: 15,000 × (2/22) = 1,363.64 BDT
- **Salary = 15,000 - 1,363.64 = 13,636.36 BDT**

## Important Notes

1. **Weekend Configuration**: Make sure `WEEKEND_DAYS` is set in `.env` file
   - Example: `WEEKEND_DAYS=5,6` (Friday=5, Saturday=6)

2. **Attendance Records**: 
   - For daily/weekly frequencies, the system relies on attendance records
   - Missing attendance records are assumed as "present"
   - Mark absences explicitly for accurate calculations

3. **Joining Month Handling**:
   - All frequencies handle joining month pro-rating
   - Daily: Limits to days from joining date
   - Weekly: Calculates weeks from joining date
   - Monthly: Pro-rates based on days worked

4. **Backward Compatibility**:
   - Existing employees without `salaryFrequency` will default to "monthly"
   - Current logic for monthly salary remains unchanged

## Testing Recommendations

1. Test daily salary with various attendance patterns
2. Test weekly salary across month boundaries
3. Test joining month scenarios for all frequencies
4. Verify weekend exclusion works correctly
5. Test half-day attendance calculations
