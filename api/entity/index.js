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
UserRole.belongsTo(User, { as: "parent", foreignKey: "parentUserId" });

// old user & userrole associations
// User.hasMany(UserRole, { as: "childUsers", foreignKey: "parentUserId" });
// User.hasOne(UserRole, { as: "roleInfo", foreignKey: "userId" });

// Parent-Child Shop Associations
User.belongsTo(User, { as: "parent", foreignKey: "parent_id" });
User.hasMany(User, { as: "children", foreignKey: "parent_id" });

// Product Associations
Product.belongsTo(User);
Product.belongsTo(Category);
Product.belongsTo(Brand);
Product.belongsTo(Unit);
Product.belongsTo(Size);
Product.belongsTo(Color);

// Category Associations
Category.belongsTo(User);
Category.hasMany(Product);

// Brand Associations
Brand.belongsTo(User);
Brand.hasMany(Product);

// Unit Associations
Unit.belongsTo(User);
Unit.hasMany(Product);

// Color & Size Associations
Color.belongsTo(User);
Size.belongsTo(User);

// Product Variant Associations
Product.hasMany(ProductVariant);
ProductVariant.belongsTo(Product);
ProductVariant.belongsTo(Color);
ProductVariant.belongsTo(Size);

// Order Associations
Order.belongsTo(User);
Order.hasMany(OrderItem);
OrderItem.belongsTo(Order);
Order.belongsTo(StuffCommission, { foreignKey: "OrderId", as: "commissions" });
StuffCommission.belongsTo(Order, { foreignKey: "OrderId", as: "order" });

// OrderItem Associations
OrderItem.belongsTo(Product);
OrderItem.belongsTo(ProductVariant);

// StockHistory Associations
StockHistory.belongsTo(Product);
StockHistory.belongsTo(ProductVariant);
StockHistory.belongsTo(Order);
StockHistory.belongsTo(User);

// UserSubscription Associations
UserSubscription.belongsTo(User);
UserSubscription.belongsTo(SubscriptionPlan);

// SubscriptionPlan Associations
SubscriptionPlan.hasMany(UserSubscription);

// UserRole Associations
// UserRole.belongsTo(User, { as: "parent", foreignKey: "parentUserId" });
UserRole.hasMany(StuffCommission, {
  foreignKey: "UserRoleId",
  as: "commissions",
});
StuffCommission.belongsTo(UserRole, {
  foreignKey: "UserRoleId",
  as: "staff",
});
User.hasMany(StuffCommission, {
  foreignKey: "UserId",
  as: "staffCommissionRecords",
});
StuffCommission.belongsTo(User, {
  foreignKey: "UserId",
  as: "shop",
});

// === PAYROLL ASSOCIATIONS ===
UserRole.hasMany(Attendance, { foreignKey: "userId" });
Attendance.belongsTo(UserRole, { foreignKey: "userId" });

// 1. Employee (requester)
LeaveRequest.belongsTo(UserRole, {
  foreignKey: "userId",
  as: "employee",
});
UserRole.hasMany(LeaveRequest, {
  foreignKey: "userId",
  as: "leaveRequests",
});

// 2. Approver (admin who approved)
LeaveRequest.belongsTo(User, {
  foreignKey: "approvedBy",
  as: "approver",
});
User.hasMany(LeaveRequest, {
  foreignKey: "approvedBy",
  as: "approvedLeaves",
});

// New correct lines
Holiday.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator",
});
User.hasMany(Holiday, {
  foreignKey: "createdBy",
  as: "createdHolidays",
});

UserRole.hasMany(PayrollRelease, { foreignKey: "userId" });
PayrollRelease.belongsTo(UserRole, { foreignKey: "userId", as: "UserRole" });

User.hasMany(PayrollRelease, {
  foreignKey: "releasedBy",
  as: "releasedSalaries",
});
PayrollRelease.belongsTo(User, { foreignKey: "releasedBy", as: "releaser" });

UserRole.hasMany(SalaryHistory, { foreignKey: "userId" });
SalaryHistory.belongsTo(UserRole, { foreignKey: "userId" });

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
};
