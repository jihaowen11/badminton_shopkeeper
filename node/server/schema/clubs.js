module.exports = function (sequelize, DataTypes) {
    return sequelize.define('clubs', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true
        },
        //名称
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'name'
        },
        //常住地
        residence: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'residence'
        },
        //简介
        intro: {
            type: DataTypes.TEXT('long'),
            allowNull: true,
            field: 'intro'
        },
        //入会方式
        joinMethod: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'join_method'
        },
        //创建者(建议传 openId 或 userId)
        creator: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'creator'
        },
        // 创建时间
        createdAt: {
            type: DataTypes.DATE
        },
        // 更新时间
        updatedAt: {
            type: DataTypes.DATE
        }
    }, {
        freezeTableName: true,
    })
}
