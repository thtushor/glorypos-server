require("dotenv").config(); // Load environment variables from .env

module.exports = {
  development: {
    username: process.env.MYSQLUSERNAME_DEV,
    password: process.env.MYSQLPASSWORD_DEV,
    database: process.env.DATABASE_DEV,
    host: process.env.MYSQLHOST_DEV,
    dialect: "mysql",
    logging: process.env.logging === "true", // Use boolean for logging
  },
  test: {
    username: process.env.MYSQLUSERNAME_DEV || "root",
    password: process.env.MYSQLPASSWORD_DEV || null,
    database: "database_test",
    host: process.env.MYSQLHOST_DEV || "127.0.0.1",
    dialect: "mysql",
  },
  production: {
    username: process.env.MYSQLUSERNAME,
    password: process.env.MYSQLPASSWORD,
    database: process.env.DATABASE,
    host: process.env.MYSQLHOST,
    dialect: "mysql",
  },
};
