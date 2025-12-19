# Payroll Release API - Implementation Summary

## Overview
Created a comprehensive API endpoint for fetching all payroll release data with advanced filtering capabilities.

## API Endpoint
```
GET /api/payroll/payroll/history
```

## Query Parameters

### Pagination
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 10) - Items per page

### Filters

#### Search Filter
- `search` (string) - Smart search that works for:
  - **Username**: Searches in employee's full name (case-insensitive, partial match)
  - **Amount**: If numeric, searches in netPayableSalary, paidAmount, and baseSalary fields

#### Date Filters
- `startDate` (string, format: YYYY-MM) - Filter by salary month >= startDate
- `endDate` (string, format: YYYY-MM) - Filter by salary month <= endDate

#### Status Filter
- `status` (string) - Filter by payroll status
  - Values: `PENDING` | `RELEASED`

#### Amount Range Filters
- `minAmount` (number) - Filter by netPayableSalary >= minAmount
- `maxAmount` (number) - Filter by netPayableSalary <= maxAmount

#### User & Shop Filters
- `userId` (number) - Filter by specific employee ID
- `shopId` (number) - Filter by specific shop ID

## Response Format

```json
{
  "status": true,
  "message": "Payroll releases fetched successfully.",
  "data": {
    "releases": [
      {
        "id": 1,
        "userId": 123,
        "salaryMonth": "2025-12",
        "baseSalary": "50000.00",
        "advanceAmount": "5000.00",
        "bonusAmount": "2000.00",
        "loanDeduction": "1000.00",
        "fineAmount": "500.00",
        "overtimeAmount": "1500.00",
        "otherDeduction": "200.00",
        "netPayableSalary": "46800.00",
        "paidAmount": "46800.00",
        "status": "RELEASED",
        "releaseDate": "2025-12-15T10:30:00.000Z",
        "releasedBy": 1,
        "shopId": 5,
        "calculationSnapshot": {},
        "createdAt": "2025-12-01T00:00:00.000Z",
        "updatedAt": "2025-12-15T10:30:00.000Z",
        "UserRole": {
          "id": 123,
          "fullName": "John Doe",
          "email": "john@example.com",
          "role": "SALESMAN",
          "baseSalary": "50000.00",
          "parent": {
            "id": 5,
            "fullName": "Admin User",
            "shopName": "Main Shop"
          }
        },
        "releaser": {
          "id": 1,
          "fullName": "Admin User",
          "email": "admin@example.com"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "totalCount": 45,
      "totalPages": 5,
      "hasMore": true
    }
  }
}
```

## Example Usage

### 1. Get all payroll releases (paginated)
```
GET /api/payroll/payroll/history?page=1&pageSize=20
```

### 2. Search by employee name
```
GET /api/payroll/payroll/history?search=John
```

### 3. Search by amount
```
GET /api/payroll/payroll/history?search=50000
```

### 4. Filter by date range
```
GET /api/payroll/payroll/history?startDate=2025-01&endDate=2025-12
```

### 5. Filter by status
```
GET /api/payroll/payroll/history?status=RELEASED
```

### 6. Filter by amount range
```
GET /api/payroll/payroll/history?minAmount=40000&maxAmount=60000
```

### 7. Filter by user and shop
```
GET /api/payroll/payroll/history?userId=123&shopId=5
```

### 8. Combined filters
```
GET /api/payroll/payroll/history?search=John&status=RELEASED&startDate=2025-01&endDate=2025-12&page=1&pageSize=20
```

## Implementation Details

### Service Method
- **Location**: `api/services/PayrollService.js`
- **Method**: `getAllPayrollReleases(accessibleShopIds, query)`
- **Features**:
  - Smart search (username or amount based on input)
  - Comprehensive filtering
  - Pagination support
  - Includes employee details with shop information
  - Includes releaser (admin who released the payroll) details
  - Sorted by salary month (DESC) and creation date (DESC)

### Route
- **Location**: `api/routes/PayrollRoutes.js`
- **Endpoint**: `GET /payroll/history`
- **Authentication**: Required
- **Shop Access**: Required (uses `addShopAccess` middleware)

### Security
- Only returns payroll releases for shops accessible to the authenticated user
- Uses `accessibleShopIds` from middleware to enforce shop-level access control

## Notes
- The search filter intelligently detects if the input is numeric or text
- All filters can be combined for complex queries
- Pagination is always applied to prevent large result sets
- The API respects shop access permissions automatically
