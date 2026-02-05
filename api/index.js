require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
const cookiesParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const errorHandler = require("./middleware/errorHandler");
const requestHandler = require("./utils/requestHandler");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const unitRoutes = require("./routes/unitRoutes");
const imageUploadRoute = require("./routes/imageUploadRoute");
const orderRoutes = require("./routes/OrderRoute");
const colorRoutes = require("./routes/colorRoutes");
const sizeRoutes = require("./routes/sizeRoutes");
const productVariantRoutes = require("./routes/productVariantRoutes");
const stockRoutes = require("./routes/stockRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const stateMentRoutes = require("./routes/statementRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const couponRoutes = require("./routes/couponRoutes");
const UserRoleRoutes = require("./routes/userRoutes");
const PayrollRoutes = require("./routes/PayrollRoutes");
const stuffCommissionRoutes = require("./routes/stuffCommissionRoutes");
const loanRoutes = require("./routes/LoanRoutes");
const thermalPrintRoutes = require("./routes/thermalPrintRoutes");
const escPosRoutes = require("./routes/escPosRoutes");

const port = process.env.SERVER_PORT || 3000;
const SchedulerService = require("./services/SchedulerService");

// Configure CORS to allow credentials (cookies)
app.use(cors());

app.use(express.json());
app.use(cookiesParser());


app.use(express.static("public"));

// here we add router

app.use("/api", requestHandler(null, authRoutes));
app.use("/api/products", requestHandler(null, productRoutes));
app.use("/api/categories", requestHandler(null, categoryRoutes));
app.use("/api/brands", requestHandler(null, brandRoutes));
app.use("/api/units", requestHandler(null, unitRoutes));
app.use("/api/images", requestHandler(null, imageUploadRoute));
app.use("/api/orders", requestHandler(null, orderRoutes));
app.use("/api/colors", requestHandler(null, colorRoutes));
app.use("/api/sizes", requestHandler(null, sizeRoutes));
app.use("/api/product-variants", requestHandler(null, productVariantRoutes));
app.use("/api/stock", requestHandler(null, stockRoutes));
app.use("/api/notifications", requestHandler(null, notificationRoutes));
app.use("/api/statement", requestHandler(null, stateMentRoutes));
app.use("/api/subscription", requestHandler(null, subscriptionRoutes));
app.use("/api/coupons", requestHandler(null, couponRoutes));
app.use("/api/user", UserRoleRoutes);
app.use("/api/payroll", requestHandler(null, PayrollRoutes));
app.use("/api/commissions", requestHandler(null, stuffCommissionRoutes));
app.use("/api/loan", requestHandler(null, loanRoutes));
app.use("/api/thermal-print", requestHandler(null, thermalPrintRoutes));
app.use("/api/escpos", requestHandler(null, escPosRoutes));

app.get("/", function (req, res) {
  res.send("welcome to glorypos family!");
});

// app.use(ErrorHandler)

app.use(errorHandler);

// Start the schedulers
SchedulerService.checkExpiredSubscriptions.start();
SchedulerService.sendRenewalReminders.start();

app.listen(port, () => console.log(`Server ready on port ${port}.`));

module.exports = app;
