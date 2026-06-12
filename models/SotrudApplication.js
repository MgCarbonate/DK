const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SotrudApplication = sequelize.define('SotrudApplication', {
        application_code: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        fio: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        space: {
            type: DataTypes.STRING,
            allowNull: false
        },
        event_type: {
            type: DataTypes.STRING
        },
        duration: {
            type: DataTypes.STRING
        },
        ticket_price: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.TEXT
        },
        user_code: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending'
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'sotrud_applications',
        timestamps: false
    });

    return SotrudApplication;
};