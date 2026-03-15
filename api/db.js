const Sequelize = require("sequelize");

require('dotenv').config();



// const sequelize = new Sequelize(
//   "mysql://uaouubcirsbebptf:UdgYAk6X8hJxlPeVq86R@btmokbo8bpouksbiy9tl-mysql.services.clever-cloud.com:3306/btmokbo8bpouksbiy9tl"
// );
// const sequelize = new Sequelize(
//   process.env.DATABASE,
//   process.env.MYSQLUSERNAME,
//   process.env.MYSQLPASSWORD,
//   {
//     host: process.env.DB_HOST,
//     dialect: "mysql",
//   }
// );


let sequelize;

const dbConfig = {
    host: process.env.NODE_ENV === 'development' ? process.env.MYSQLHOST_DEV : process.env.MYSQLHOST,
    dialect: 'mysql',
    logging: false,
    port: process.env.PORT,
    pool: {
        max: 30,             // Increased max connections for concurrent requests
        min: 5,              // Keep 5 connections always warm for faster response times
        acquire: 60000,      // Maximum time (ms) that pool will try to get connection before throwing error
        idle: 10000,         // Maximum time (ms) that a connection can be idle before being released
        evict: 1000          // Time (ms) interval to check for idle/stale connections
    },
    dialectOptions: {
        connectTimeout: 60000 // 60s timeout for initial connection attempt
    }
};


if (process.env.NODE_ENV === 'development') {
    sequelize = new Sequelize(
        process.env.DATABASE_DEV,
        process.env.MYSQLUSERNAME_DEV,
        process.env.MYSQLPASSWORD_DEV,
        dbConfig
    );
} else {
    sequelize = new Sequelize(
        process.env.DATABASE,
        process.env.MYSQLUSERNAME,
        process.env.MYSQLPASSWORD,
        dbConfig
    );
}


// force: true
// alter: true

const syncOptions = { alter: true };

sequelize
    .sync(syncOptions)

    .then(async (res) => {
        console.log("Database Connected", process.env.PORT);
    })
    .catch((error) => {
        console.error("Failed to synchronize database:", error);
    });

module.exports = sequelize;




// const Sequelize = require("sequelize");

// const sequelize = new Sequelize(
//   "mysql://uaouubcirsbebptf:UdgYAk6X8hJxlPeVq86R@btmokbo8bpouksbiy9tl-mysql.services.clever-cloud.com:3306/btmokbo8bpouksbiy9tl"
// );

// sequelize
//   .sync({ force: true })
//   .then(() => {
//     console.log("Database Connected");
//   })
//   .catch((error) => {
//     console.error("Failed to synchronize database:", error);
//   });

// module.exports = sequelize;
