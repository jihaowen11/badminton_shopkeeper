/**
 * 今日贴士表
 *
 * 设计说明：
 * 1. 不做"哪天用哪条"的排期字段。每日一条是纯计算出来的（见 modules/tips.js
 *    的 dayIndexOf），表里只存内容，不需要定时任务去改状态。
 * 2. category 用来给前端显示小标签（步法/发力/双打…），不参与逻辑。
 * 3. status 用来下架某条文案，0 停用 1 启用；停用后不会出现在轮换里。
 */
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('tips', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true
        },
        //短标题（列表页/摘要用，首页只显示正文）
        title: {
            type: DataTypes.STRING(64),
            allowNull: true,
            field: 'title'
        },
        //贴士正文
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'content'
        },
        //分类：步法/发力/杀球/网前/双打/战术/装备/热身/心态
        category: {
            type: DataTypes.STRING(32),
            allowNull: true,
            field: 'category'
        },
        //状态：0停用 1启用
        status: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 1,
            field: 'status'
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
    }, {
        freezeTableName: true,
        indexes: [
            { fields: ['status'] }
        ]
    })
}
