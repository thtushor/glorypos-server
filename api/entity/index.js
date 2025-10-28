const User = require('./User');
const Product = require('./Product');
const Category = require('./Category');
const Brand = require('./Brand');
const Unit = require('./Unit');
const Order = require('./Order');
const Color = require('./Color');
const Size = require('./Size');
const ProductVariant = require('./ProductVariant');
const OrderItem = require('./OrderItem');
const StockHistory = require('./StockHistory');
const SubscriptionPlan = require('./SubscriptionPlan');
const UserSubscription = require('./UserSubscription');
const Coupon = require('./Coupon');
const UserRole = require('./UserRole');

// User Associations
User.hasMany(Product);
User.hasMany(Category);
User.hasMany(Brand);
User.hasMany(Unit);
User.hasMany(Color);
User.hasMany(Size);
User.hasMany(UserSubscription);
User.hasMany(UserRole, { as: 'childUsers', foreignKey: 'parentUserId' });
User.hasOne(UserRole, { as: 'roleInfo', foreignKey: 'userId' });

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
UserRole.belongsTo(User, { as: 'parent', foreignKey: 'parentUserId' });


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
    UserRole
};