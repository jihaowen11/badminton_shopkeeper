/**
 * 排期表：一行 = 某个比赛某一轮某一号场地的一场双打
 *
 * 为什么单独建表而不是复用 match_scores：
 * match_scores 记的是"第几局比分"，没有轮次/场地/搭档信息，无法支撑轮转排期。
 * 这里以 openId 直接存四个位置，读的时候再关联用户资料，
 * 这样昵称头像改了以后排期里显示的是最新值。
 */
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('match_rounds', {
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
        //第几轮（从 1 开始）
        roundNo: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'round_no'
        },
        //第几号场地（从 1 开始）
        courtNo: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'court_no'
        },
        //A 队两人
        team1P1: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'team1_p1'
        },
        team1P2: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'team1_p2'
        },
        //B 队两人
        team2P1: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'team2_p1'
        },
        team2P2: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'team2_p2'
        },
        //比分，null 表示还没打
        team1Score: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'team1_score'
        },
        team2Score: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'team2_score'
        },
        //状态：0待开始 1已结束
        status: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'status'
        },
        // 创建时间
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        // 更新时间
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
    }, {
        freezeTableName: true,
        indexes: [
            { fields: ['match_id', 'round_no', 'court_no'], unique: true }
        ]
    })
}
