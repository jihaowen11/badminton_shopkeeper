module.exports = function (sequelize, DataTypes) {
    return sequelize.define('matches', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true
        },
        //俱乐部编号（可选）
        clubId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'club_id'
        },
        //活动编号
        activityId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'activity_id'
        },
        //比赛类型：1单打 2双打 3混双
        type: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'type'
        },
        //组织方式：1现场组织 2预报名
        organizeMode: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 1,
            field: 'organize_mode'
        },
        //比赛名称
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'name'
        },
        //赛制
        competitionFormat: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'competition_format'
        },
        //分制
        targetScore: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'target_score'
        },
        //几局几胜
        bestOf: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'best_of'
        },
        //状态：1报名中 2进行中 3已结束 4中断 5取消
        status: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 1,
            field: 'status'
        },
        //开始时间
        startTime: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'start_time'
        },
        //结束时间
        endTime: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'end_time'
        },
        //地点
        address: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'address'
        },
        //浏览量
        views: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'views'
        },
        //创建人
        createdBy: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'created_by'
        },
        //人数
        playerCount: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            field: 'player_count'
        },
        //场次
        sessionCount: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'session_count'
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
        indexes: [
            { name: 'idx_matches_created_by', fields: ['created_by'] },
            { name: 'idx_matches_club_status', fields: ['club_id', 'status'] },
            { name: 'idx_matches_start_time', fields: ['start_time'] }
        ]
    })
}
