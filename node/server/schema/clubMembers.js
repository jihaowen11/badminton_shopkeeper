module.exports = function (sequelize, DataTypes) {
    return sequelize.define('club_members', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true
        },
        //俱乐部ID
        clubId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'club_id'
        },
        //用户ID
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'user_id'
        },
        //冗余字段：用户名称
        userName: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'user_name'
        },
        //冗余字段：用户头像
        userAvatar: {
            type: DataTypes.TEXT('long'),
            allowNull: true,
            field: 'user_avatar'
        },
        //角色(如 owner/admin/member)
        role: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'role'
        },
        //状态(如 0待审核/1正常/2禁用/3退出)
        status: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 1,
            field: 'status'
        },
        //活跃度
        activity: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'activity'
        },
        //加入时间
        joinedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'joined_at'
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
