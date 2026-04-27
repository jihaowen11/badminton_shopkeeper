const Sequelize = require('sequelize');
const sequelize = new Sequelize('badminton', 'root', 'Jhw3975376', {
    host: '127.0.0.1',
    dialect: 'mysql',
    port: 3306,
    operatorsAliases: 0,
    dialectOptions: {
        //字符集
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        supportBigNumbers: true,
        bigNumberStrings: true
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    timezone: '+08:00'  //东八时区
});

// sequelize
//     .authenticate()
//     .then(() => {
//         console.log('******Connection has been established successfully.********');
//         console.log('******测试结束，即将退出！！！********');
//         process.exit(); //结束进程
//     })
//     .catch(err => {
//         console.error('***************Unable to connect to the database:***********', err);
//     });

module.exports = {
    sequelize
};