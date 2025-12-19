// Test Payload Examples for Payroll Release with Validation
// Use these examples to test the API endpoint

// Example 1: Full Payment with All Fields
const fullPaymentExample = {
    userId: 123,
    salaryMonth: "2025-01",
    baseSalary: 50000,
    shopId: 456,

    // Editable fields
    advanceAmount: 5000,
    bonusAmount: 3000,
    bonusDescription: "Performance bonus for Q4 2024",
    fineAmount: 500,
    overtimeAmount: 2000,
    otherDeduction: 100,

    // Calculated fields
    loanDeduction: 1000,
    netPayableSalary: 48400,
    paidAmount: 48400,

    calculationSnapshot: {
        workingDays: 26,
        presentDays: 24,
        paidLeaveDays: 1,
        unpaidLeaveDays: 1,
        perDaySalary: 1923.08,
        unpaidLeaveDeduction: 1923.08,

        advance: {
            totalTaken: 10000,
            totalRepaidBefore: 5000,
            deductedThisMonth: 5000,
            remaining: 0
        },

        commission: {
            totalSales: 100000,
            commissionRate: "2%",
            commissionAmount: 2000
        },

        salaryBreakdown: {
            gross: 55000,
            totalDeductions: 6600,
            netPayable: 48400,
            paid: 48400,
            due: 0
        }
    }
};

// Example 2: Partial Payment
const partialPaymentExample = {
    userId: 124,
    salaryMonth: "2025-01",
    baseSalary: 40000,
    shopId: 456,

    // Only advance deduction
    advanceAmount: 3000,

    // Calculated fields
    loanDeduction: 0,
    netPayableSalary: 35076.92,
    paidAmount: 30000, // Partial payment

    calculationSnapshot: {
        workingDays: 26,
        presentDays: 24,
        paidLeaveDays: 0,
        unpaidLeaveDays: 2,
        perDaySalary: 1538.46,
        unpaidLeaveDeduction: 3076.92,

        advance: {
            totalTaken: 8000,
            totalRepaidBefore: 2000,
            deductedThisMonth: 3000,
            remaining: 3000
        },

        salaryBreakdown: {
            gross: 40000,
            totalDeductions: 4923.08,
            netPayable: 35076.92,
            paid: 30000,
            due: 5076.92
        }
    }
};

// Example 3: No Deductions (Clean Salary)
const cleanSalaryExample = {
    userId: 125,
    salaryMonth: "2025-01",
    baseSalary: 60000,
    shopId: 456,

    // Bonus only
    bonusAmount: 5000,
    bonusDescription: "Year-end bonus",

    // Calculated fields
    loanDeduction: 0,
    netPayableSalary: 65000,
    paidAmount: 65000,

    calculationSnapshot: {
        workingDays: 26,
        presentDays: 26,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        perDaySalary: 2307.69,
        unpaidLeaveDeduction: 0,

        advance: {
            totalTaken: 0,
            totalRepaidBefore: 0,
            deductedThisMonth: 0,
            remaining: 0
        },

        salaryBreakdown: {
            gross: 65000,
            totalDeductions: 0,
            netPayable: 65000,
            paid: 65000,
            due: 0
        }
    }
};

// Example 4: With Commission
const withCommissionExample = {
    userId: 126,
    salaryMonth: "2025-01",
    baseSalary: 30000,
    shopId: 456,

    // Editable fields
    advanceAmount: 2000,
    overtimeAmount: 1500,

    // Calculated fields
    loanDeduction: 500,
    netPayableSalary: 33000,
    paidAmount: 33000,

    calculationSnapshot: {
        workingDays: 26,
        presentDays: 26,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        perDaySalary: 1153.85,
        unpaidLeaveDeduction: 0,

        advance: {
            totalTaken: 5000,
            totalRepaidBefore: 1000,
            deductedThisMonth: 2000,
            remaining: 2000
        },

        commission: {
            totalSales: 150000,
            commissionRate: "3%",
            commissionAmount: 4500
        },

        salaryBreakdown: {
            gross: 36000, // 30000 + 4500 + 1500
            totalDeductions: 3000, // 2000 + 500
            netPayable: 33000,
            paid: 33000,
            due: 0
        }
    }
};

// Example 5: Validation Error Example (Base Salary Mismatch)
const validationErrorExample = {
    userId: 127,
    salaryMonth: "2025-01",
    baseSalary: 45000, // Wrong! Employee's actual salary is 50000
    shopId: 456,

    loanDeduction: 0,
    netPayableSalary: 45000,
    paidAmount: 45000,

    calculationSnapshot: {
        workingDays: 26,
        presentDays: 26,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        perDaySalary: 1730.77,
        unpaidLeaveDeduction: 0,

        advance: {
            totalTaken: 0,
            totalRepaidBefore: 0,
            deductedThisMonth: 0,
            remaining: 0
        },

        salaryBreakdown: {
            gross: 45000,
            totalDeductions: 0,
            netPayable: 45000,
            paid: 45000,
            due: 0
        }
    }
};

// Example 6: Advance Exceeds Outstanding
const advanceExceedsExample = {
    userId: 128,
    salaryMonth: "2025-01",
    baseSalary: 50000,
    shopId: 456,

    advanceAmount: 8000, // Error! Outstanding is only 5000

    loanDeduction: 0,
    netPayableSalary: 42000,
    paidAmount: 42000,

    calculationSnapshot: {
        workingDays: 26,
        presentDays: 26,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        perDaySalary: 1923.08,
        unpaidLeaveDeduction: 0,

        advance: {
            totalTaken: 10000,
            totalRepaidBefore: 5000,
            deductedThisMonth: 8000, // This will fail validation
            remaining: -3000
        },

        salaryBreakdown: {
            gross: 50000,
            totalDeductions: 8000,
            netPayable: 42000,
            paid: 42000,
            due: 0
        }
    }
};

// How to use these examples:
// 1. Copy one of the examples above
// 2. Update the userId, salaryMonth, and shopId with real values
// 3. Make a POST request to /api/payroll/payroll/release-with-validation
// 4. Check the response

// Example using fetch:
async function testPayrollRelease(payload, token) {
    try {
        const response = await fetch('http://localhost:3000/api/payroll/payroll/release-with-validation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('Response:', result);

        if (result.status) {
            console.log('✅ Success! Payroll released:', result.data.id);
        } else {
            console.log('❌ Validation failed:', result.message);
        }

        return result;
    } catch (error) {
        console.error('❌ API call failed:', error);
        throw error;
    }
}

// Example usage:
// testPayrollRelease(fullPaymentExample, 'your-auth-token-here');

module.exports = {
    fullPaymentExample,
    partialPaymentExample,
    cleanSalaryExample,
    withCommissionExample,
    validationErrorExample,
    advanceExceedsExample,
    testPayrollRelease
};
