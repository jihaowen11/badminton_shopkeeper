
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('users', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true
        },
        //openid
        openId: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'open_id'
        },
        //昵称
        nickName: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'nick_name'
        },
        //头像
        avatar: {
            type: DataTypes.TEXT('long'),
            allowNull: true,
            field: 'avatar'
        },
        //性别(0未知/1男/2女)
        gender: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'gender'
        },
        //羽毛球等级
        badmintonLevel: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'badminton_level'
        },
        //姓名
        name: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'name'
        },
        //手机号
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'phone'
        },
        //账号等级
        accountLevel: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'account_level'
        },
        //积分
        points: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'points'
        },
        //备注
        remark: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'remark'
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