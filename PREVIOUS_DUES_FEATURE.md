# Previous Dues Calculation - Feature Documentation

## Overview
The payroll calculation system now automatically includes **previous months' unpaid dues** in the current month's net payable salary calculation.

## How It Works

### Calculation Flow

1. **Fetch Previous Payrolls**
   - Gets all payroll releases for the user from months before the current month
   - Ordered by salary month (oldest first)

2. **Calculate Dues for Each Month**
   ```javascript
   due = netPayableSalary - paidAmount
   ```

3. **Sum Total Previous Dues**
   - Only includes dues > 0.01 (to handle floating-point precision)
   - Maintains a breakdown by month

4. **Add to Current Month**
   ```javascript
   finalNetPayable = currentMonthNetPayable + totalPreviousDues
   ```

## Example Scenarios

### Scenario 1: No Previous Dues
```javascript
// January 2025
Current Month Net Payable: 50,000
Previous Dues: 0
Final Net Payable: 50,000

Response:
{
  currentMonthNetPayable: 50000,
  totalPreviousDues: 0,
  previousDuesBreakdown: [],
  hasPreviousDues: false,
  netPayableSalary: 50000
}
```

### Scenario 2: One Month with Partial Payment
```javascript
// December 2024
Net Payable: 50,000
Paid: 30,000
Due: 20,000

// January 2025
Current Month Net Payable: 50,000
Previous Dues: 20,000 (from December)
Final Net Payable: 70,000

Response:
{
  currentMonthNetPayable: 50000,
  totalPreviousDues: 20000,
  previousDuesBreakdown: [
    {
      salaryMonth: "2024-12",
      netPayable: 50000,
      paid: 30000,
      due: 20000
    }
  ],
  hasPreviousDues: true,
  netPayableSalary: 70000
}
```

### Scenario 3: Multiple Months with Dues
```javascript
// November 2024
Net Payable: 45,000
Paid: 40,000
Due: 5,000

// December 2024
Net Payable: 50,000
Paid: 35,000
Due: 15,000

// January 2025
Current Month Net Payable: 50,000
Previous Dues: 20,000 (5,000 + 15,000)
Final Net Payable: 70,000

Response:
{
  currentMonthNetPayable: 50000,
  totalPreviousDues: 20000,
  previousDuesBreakdown: [
    {
      salaryMonth: "2024-11",
      netPayable: 45000,
      paid: 40000,
      due: 5000
    },
    {
      salaryMonth: "2024-12",
      netPayable: 50000,
      paid: 35000,
      due: 15000
    }
  ],
  hasPreviousDues: true,
  netPayableSalary: 70000
}
```

### Scenario 4: Fully Paid Previous Months
```javascript
// December 2024
Net Payable: 50,000
Paid: 50,000
Due: 0 (fully paid)

// January 2025
Current Month Net Payable: 50,000
Previous Dues: 0
Final Net Payable: 50,000

Response:
{
  currentMonthNetPayable: 50000,
  totalPreviousDues: 0,
  previousDuesBreakdown: [],
  hasPreviousDues: false,
  netPayableSalary: 50000
}
```

## API Response Structure

### New Fields in `calculateMonthlyPayrollDetails`

```javascript
{
  status: true,
  message: "Payroll calculated successfully",
  data: {
    // ... existing fields ...
    
    // NEW: Previous Dues Information
    totalPreviousDues: 20000,           // Total unpaid from previous months
    previousDuesBreakdown: [            // Breakdown by month
      {
        salaryMonth: "2024-12",
        netPayable: 50000,
        paid: 30000,
        due: 20000
      }
    ],
    hasPreviousDues: true,              // Quick check flag
    
    // NEW: Current Month Breakdown
    currentMonthNetPayable: 50000,      // This month's calculation only
    
    // UPDATED: Final Net Payable
    netPayableSalary: 70000,            // Current month + previous dues
    
    // ... other fields ...
    
    calculationSnapshot: {
      // ... existing snapshots ...
      
      // NEW: Previous Dues Snapshot
      previousDues: {
        total: 20000,
        breakdown: [
          {
            salaryMonth: "2024-12",
            netPayable: 50000,
            paid: 30000,
            due: 20000
          }
        ]
      }
    }
  }
}
```

## Frontend Integration

### Display Previous Dues to User

```javascript
const PayrollSummary = ({ payrollDetails }) => {
  const {
    currentMonthNetPayable,
    totalPreviousDues,
    previousDuesBreakdown,
    hasPreviousDues,
    netPayableSalary
  } = payrollDetails;

  return (
    <div>
      <h3>Salary Breakdown</h3>
      
      {/* Current Month */}
      <div>
        <label>Current Month Salary:</label>
        <span>{money.format(currentMonthNetPayable)}</span>
      </div>
      
      {/* Previous Dues */}
      {hasPreviousDues && (
        <div className="previous-dues">
          <label>Previous Months' Dues:</label>
          <span className="text-red-600">
            {money.format(totalPreviousDues)}
          </span>
          
          {/* Breakdown */}
          <div className="breakdown">
            {previousDuesBreakdown.map((item) => (
              <div key={item.salaryMonth}>
                <span>{item.salaryMonth}:</span>
                <span>
                  Paid: {money.format(item.paid)} / 
                  Total: {money.format(item.netPayable)} = 
                  Due: {money.format(item.due)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Total */}
      <div className="total">
        <label>Total Payable:</label>
        <span className="font-bold">
          {money.format(netPayableSalary)}
        </span>
      </div>
      
      {hasPreviousDues && (
        <p className="note">
          * Includes {money.format(totalPreviousDues)} from previous months
        </p>
      )}
    </div>
  );
};
```

### Calculate Payment with Dues

```javascript
const handleReleaseSalary = () => {
  const {
    currentMonthNetPayable,
    totalPreviousDues,
    netPayableSalary
  } = payrollDetails;

  // Show breakdown to user
  console.log('Current Month:', currentMonthNetPayable);
  console.log('Previous Dues:', totalPreviousDues);
  console.log('Total to Pay:', netPayableSalary);

  // User can choose to pay:
  // 1. Full amount (current + dues)
  // 2. Current month only
  // 3. Partial amount
  
  const payload = {
    // ... other fields ...
    netPayableSalary: netPayableSalary,  // Total including dues
    paidAmount: selectedPaymentAmount,    // User's choice
    
    calculationSnapshot: {
      // ... include previous dues breakdown ...
      previousDues: {
        total: totalPreviousDues,
        breakdown: previousDuesBreakdown
      }
    }
  };

  releaseMutation(payload);
};
```

## Payment Strategies

### Strategy 1: Pay Everything (Recommended)
```javascript
paidAmount = netPayableSalary
// Clears current month + all previous dues
```

### Strategy 2: Pay Current Month Only
```javascript
paidAmount = currentMonthNetPayable
// Pays current month, dues carry forward to next month
```

### Strategy 3: Partial Payment
```javascript
paidAmount = someAmount
// Partial payment, remaining carries forward
```

## Important Notes

### 1. **Dues Accumulate**
- Unpaid amounts from previous months automatically add to future months
- No manual tracking needed

### 2. **Transparency**
- Full breakdown provided for each month with dues
- Users can see exactly what's owed from which month

### 3. **Flexible Payment**
- Can pay full amount (current + dues)
- Can pay current month only
- Can make partial payments

### 4. **Automatic Calculation**
- System automatically fetches and calculates dues
- No additional API calls needed

### 5. **Historical Tracking**
- `previousDuesBreakdown` shows month-by-month history
- Easy to audit and verify

## Database Queries

### Query to Check User's Dues
```sql
SELECT 
  salaryMonth,
  netPayableSalary,
  paidAmount,
  (netPayableSalary - paidAmount) as due
FROM PayrollReleases
WHERE userId = ?
  AND salaryMonth < ?
  AND (netPayableSalary - paidAmount) > 0.01
ORDER BY salaryMonth ASC;
```

### Query to Get Total Dues
```sql
SELECT 
  SUM(netPayableSalary - paidAmount) as totalDues
FROM PayrollReleases
WHERE userId = ?
  AND salaryMonth < ?
  AND (netPayableSalary - paidAmount) > 0.01;
```

## Benefits

1. ✅ **Automatic Tracking** - No manual calculation needed
2. ✅ **Transparent** - Full breakdown provided
3. ✅ **Flexible** - Multiple payment strategies supported
4. ✅ **Accurate** - System-calculated, no human error
5. ✅ **Auditable** - Complete history maintained
6. ✅ **Fair** - Employees see exactly what's owed

## Testing

### Test Case 1: No Previous Dues
```javascript
// Setup: No previous payrolls
// Expected: totalPreviousDues = 0, hasPreviousDues = false
```

### Test Case 2: One Month with Dues
```javascript
// Setup: Dec 2024 - Paid 30k out of 50k
// Expected: totalPreviousDues = 20000
```

### Test Case 3: Multiple Months with Dues
```javascript
// Setup: 
//   Nov 2024 - Paid 40k out of 45k (due: 5k)
//   Dec 2024 - Paid 35k out of 50k (due: 15k)
// Expected: totalPreviousDues = 20000
```

### Test Case 4: Fully Paid Previous Months
```javascript
// Setup: Dec 2024 - Paid 50k out of 50k
// Expected: totalPreviousDues = 0
```

### Test Case 5: Mixed (Some Paid, Some Dues)
```javascript
// Setup:
//   Nov 2024 - Fully paid
//   Dec 2024 - Partial payment (due: 10k)
// Expected: totalPreviousDues = 10000
```

## Migration Impact

### No Database Changes Required ✅
- Uses existing `PayrollRelease` table
- No schema modifications needed

### Backward Compatible ✅
- Existing payroll calculations still work
- New fields are additive, not breaking

### Automatic for All Users ✅
- Works immediately for all employees
- No configuration needed

## Summary

This feature ensures that **unpaid salary from previous months automatically carries forward** to the current month's calculation, providing:

- **Complete transparency** on what's owed
- **Automatic tracking** of dues
- **Flexible payment** options
- **Accurate calculations** every time

Employees will never lose track of unpaid amounts, and the system maintains a complete audit trail of all dues!
