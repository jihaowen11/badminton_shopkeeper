module.exports = function (sequelize, DataTypes) {
    return sequelize.define('match_participants', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true
        },
        //比赛ID
        matchId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'match_id'
        },
        //用户标识（openId）
        userId: {
            type: DataTypes.STRING,
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
        //号码/编号
        number: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'number'
        },
        //队伍ID
        teamId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'team_id'
        },
        //状态
        status: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 1,
            field: 'status'
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
