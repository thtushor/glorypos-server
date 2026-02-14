const User = require("./User");
const Product = require("./Product");
const Category = require("./Category");
const Brand = require("./Brand");
const Unit = require("./Unit");
const Order = require("./Order");
const Color = require("./Color");
const Size = require("./Size");
const ProductVariant = require("./ProductVariant");
const OrderItem = require("./OrderItem");
const StockHistory = require("./StockHistory");
const SubscriptionPlan = require("./SubscriptionPlan");
const UserSubscription = require("./UserSubscription");
const Coupon = require("./Coupon");
const UserRole = require("./UserRole");
const StuffCommission = require("./StuffCommission");

// === PAYROLL MODELS ===
const Attendance = require("./Attendance");
const LeaveRequest = require("./LeaveRequest");
const Holiday = require("./Holiday");
const PayrollRelease = require("./PayrollRelease");
const SalaryHistory = require("./SalaryHistory");
const EmployeeLoan = require("./EmployeeLoan");
const LoanPayment = require("./LoanPayment");
const AdvanceSalary = require("./AdvanceSalary"); // Added
const PayrollFine = require("./PayrollFine"); // Added
const Notification = require("./Notification");


// User Associations
User.hasMany(Product);
User.hasMany(Category);
User.hasMany(Brand);
User.hasMany(Unit);
User.hasMany(Color);
User.hasMany(Size);
User.hasMany(UserSubscription);

// === USER & USERROLE ===
User.hasMany(UserRole, { as: "childUsers", foreignKey: "parentUserId" });
UserRole.belongsTo(User, { as: "parent", foreignKey: { name: "parentUserId", allowNull: true }, constraints: false });

// old user & userrole associations
// User.hasMany(UserRole, { as: "childUsers", foreignKey: "parentUserId" });
// User.hasOne(UserRole, { as: "roleInfo", foreignKey: "userId" });

// Parent-Child Shop Associations
User.belongsTo(User, { as: "parent", foreignKey: { name: "parent_id", allowNull: true }, constraints: false });
User.hasMany(User, { as: "children", foreignKey: "parent_id" });

// Product Associations
Product.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });
Product.belongsTo(Category, { foreignKey: { allowNull: true }, constraints: false });
Product.belongsTo(Brand, { foreignKey: { allowNull: true }, constraints: false });
Product.belongsTo(Unit, { foreignKey: { allowNull: true }, constraints: false });
Product.belongsTo(Size, { foreignKey: { allowNull: true }, constraints: false });
Product.belongsTo(Color, { foreignKey: { allowNull: true }, constraints: false });

// Category Associations
Category.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });
Category.hasMany(Product);

// Brand Associations
Brand.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });
Brand.hasMany(Product);

// Unit Associations
Unit.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });
Unit.hasMany(Product);

// Color & Size Associations
Color.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });
Size.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });

// Product Variant Associations
Product.hasMany(ProductVariant);
ProductVariant.belongsTo(Product, { foreignKey: { allowNull: true }, constraints: false });
ProductVariant.belongsTo(Color, { foreignKey: { allowNull: true }, constraints: false });
ProductVariant.belongsTo(Size, { foreignKey: { allowNull: true }, constraints: false });

// Order Associations
Order.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });
Order.hasMany(OrderItem);
OrderItem.belongsTo(Order, { foreignKey: { allowNull: true }, constraints: false });
Order.hasMany(StuffCommission, { foreignKey: "OrderId", as: "commissions" });
StuffCommission.belongsTo(Order, { foreignKey: { name: "OrderId", allowNull: true }, as: "order", constraints: false });

// OrderItem Associations
OrderItem.belongsTo(Product, { foreignKey: { allowNull: true }, constraints: false });
OrderItem.belongsTo(ProductVariant, { foreignKey: { allowNull: true }, constraints: false });

// StockHistory Associations
StockHistory.belongsTo(Product, { foreignKey: { allowNull: true }, constraints: false });
StockHistory.belongsTo(ProductVariant, { foreignKey: { allowNull: true }, constraints: false });
StockHistory.belongsTo(Order, { foreignKey: { allowNull: true }, constraints: false });
StockHistory.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });

// UserSubscription Associations
UserSubscription.belongsTo(User, { foreignKey: { allowNull: true }, constraints: false });
UserSubscription.belongsTo(SubscriptionPlan, { foreignKey: { allowNull: true }, constraints: false });

// SubscriptionPlan Associations
SubscriptionPlan.hasMany(UserSubscription);

// UserRole Associations
// UserRole.belongsTo(User, { as: "parent", foreignKey: "parentUserId" });
UserRole.hasMany(StuffCommission, {
  foreignKey: "UserRoleId",
  as: "commissions",
});
StuffCommission.belongsTo(UserRole, {
  foreignKey: { name: "UserRoleId", allowNull: true },
  as: "staff",
  constraints: false
});
User.hasMany(StuffCommission, {
  foreignKey: "UserId",
  as: "staffCommissionRecords",
});
StuffCommission.belongsTo(User, {
  foreignKey: { name: "UserId", allowNull: true },
  as: "shop",
  constraints: false
});

// === PAYROLL ASSOCIATIONS ===
UserRole.hasMany(Attendance, { foreignKey: "userId" });
Attendance.belongsTo(UserRole, { foreignKey: { name: "userId", allowNull: true }, constraints: false });

// 1. Employee (requester)
LeaveRequest.belongsTo(UserRole, {
  foreignKey: { name: "userId", allowNull: true },
  as: "employee",
  constraints: false
});
UserRole.hasMany(LeaveRequest, {
  foreignKey: "userId",
  as: "leaveRequests",
});

// 2. Approver (admin who approved)
LeaveRequest.belongsTo(User, {
  foreignKey: { name: "approvedBy", allowNull: true },
  as: "approver",
  constraints: false
});

User.hasMany(LeaveRequest, {
  foreignKey: "approvedBy",
  as: "approvedLeaves",
});

// New correct lines
Holiday.belongsTo(User, {
  foreignKey: { name: "createdBy", allowNull: true },
  as: "creator",
  constraints: false
});
User.hasMany(Holiday, {
  foreignKey: "createdBy",
  as: "createdHolidays",
});

UserRole.hasMany(PayrollRelease, { foreignKey: "userId" });
PayrollRelease.belongsTo(UserRole, { foreignKey: { name: "userId", allowNull: true }, as: "UserRole", constraints: false });

User.hasMany(PayrollRelease, {
  foreignKey: "releasedBy",
  as: "releasedSalaries",
});
PayrollRelease.belongsTo(User, { foreignKey: { name: "releasedBy", allowNull: true }, as: "releaser", constraints: false });

UserRole.hasMany(SalaryHistory, { foreignKey: "userId" });
SalaryHistory.belongsTo(UserRole, { foreignKey: { name: "userId", allowNull: true }, constraints: false });

// Loan Associations
UserRole.hasMany(EmployeeLoan, { foreignKey: "employeeId" });
EmployeeLoan.belongsTo(UserRole, { foreignKey: { name: "employeeId", allowNull: true }, constraints: false });

EmployeeLoan.hasMany(LoanPayment, { foreignKey: "loanId" });
LoanPayment.belongsTo(EmployeeLoan, { foreignKey: { name: "loanId", allowNull: true }, constraints: false });

User.hasMany(LoanPayment, { foreignKey: "paidBy" });
LoanPayment.belongsTo(User, { foreignKey: { name: "paidBy", allowNull: true }, constraints: false });

// AdvanceSalary Associations
UserRole.hasMany(AdvanceSalary, { foreignKey: "userId" });
AdvanceSalary.belongsTo(UserRole, { foreignKey: { name: "userId", allowNull: true }, constraints: false });

// PayrollFine Associations
UserRole.hasMany(PayrollFine, { foreignKey: "userId" });
PayrollFine.belongsTo(UserRole, { foreignKey: { name: "userId", allowNull: true }, constraints: false });

// Notification Associations
User.hasMany(Notification, { foreignKey: "shop_id" });
Notification.belongsTo(User, { foreignKey: "shop_id", as: "shop", constraints: false });



module.exports = {
  User,
  Product,
  Category,
  Brand,
  Unit,
  Order,
  Color,
  Size,
  ProductVariant,
  OrderItem,
  StockHistory,
  SubscriptionPlan,
  UserSubscription,
  Coupon,
  UserRole,
  StuffCommission,
  // === EXPORT PAYROLL MODELS ===
  Attendance,
  LeaveRequest,
  Holiday,
  PayrollRelease,
  SalaryHistory,
  EmployeeLoan,
  LoanPayment,
  AdvanceSalary,
  PayrollFine,
  Notification,
};

