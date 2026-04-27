module.exports = function (sequelize, DataTypes) {
    return sequelize.define('match_scores', {
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
        //第几场(第几局)
        gameNumber: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'game_number'
        },
        //队伍1
        team1: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'team1'
        },
        //队伍2
        team2: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'team2'
        },
        //队伍1得分
        team1Score: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'team1_score'
        },
        //队伍2得分
        team2Score: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'team2_score'
        },
        //裁判
        referee: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'referee'
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
