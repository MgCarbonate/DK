const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ActionLog = sequelize.define('ActionLog', {
        action_code: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_code: {
            type: DataTypes.INTEGER
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'actions',
        timestamps: false
    });

    return ActionLog;
};