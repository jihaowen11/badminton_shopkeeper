const Sequelize = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(
    env.get('DB_NAME', 'badminton'),
    env.get('DB_USER', 'root'),
    env.get('DB_PASSWORD', ''),
    {
        host: env.get('DB_HOST', '127.0.0.1'),
        dialect: 'mysql',
        port: env.getNumber('DB_PORT', 3306),
        operatorsAliases: 0,
        dialectOptions: {
            //字符集（collate 不是 mysql2 的合法参数，会刷警告，这里不传）
            charset: 'utf8mb4',
            supportBigNumbers: true,
            bigNumberStrings: true
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        timezone: env.get('DB_TIMEZONE', '+08:00'),  //东八时区
        logging: false
    }
);

module.exports = {
    sequelize
};
