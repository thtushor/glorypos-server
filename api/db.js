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

if (process.env.NODE_ENV === 'development') {
    // sequelize = new Sequelize(
    //     "mysql://moviesho_fashionpos:shufol@1115@103.113.13.67:3306/moviesho_fashion_glory_pos"
    // );
    sequelize = new Sequelize(
        process.env.DATABASE_DEV,
        process.env.MYSQLUSERNAME_DEV,
        process.env.MYSQLPASSWORD_DEV,
        {
            host: process.env.MYSQLHOST_DEV,
            dialect: 'mysql',
            logging: true,
            port: process.env.PORT
        }
    );
} else {
    // sequelize = new Sequelize(
    //     "mysql://uog4ysk637odggcp:s9rfzvRg1MV5s6G55KI5@beukpt9myo2zezgwjcj0-mysql.services.clever-cloud.com:3306/beukpt9myo2zezgwjcj0", {
    //     logging: false
    // }
    // );

    sequelize = new Sequelize(
        process.env.DATABASE,
        process.env.MYSQLUSERNAME,
        process.env.MYSQLPASSWORD,
        {
            host: process.env.MYSQLHOST,
            dialect: 'mysql',
            logging: false,
            port: process.env.PORT
        }
    );


}

// force: true
// alter: true

sequelize
    // .sync({ force: false })   // ✅ NO ALTER
    .sync({ alter: true, force: false })
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
