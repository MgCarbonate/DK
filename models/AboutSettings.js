const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AboutSettings = sequelize.define('AboutSettings', {
        setting_code: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        setting_key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        setting_value: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'about_settings',
        timestamps: false
    });

    return AboutSettings;
};