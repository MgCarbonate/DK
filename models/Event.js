const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Event = sequelize.define('Event', {
        event_code: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title_full: {
            type: DataTypes.STRING,
            allowNull: false
        },
        title_short: {
            type: DataTypes.STRING,
            allowNull: false
        },
        curator: {
            type: DataTypes.STRING,
            allowNull: false
        },
        event_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        time: {
            type: DataTypes.STRING,
            allowNull: false
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        total_seats: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        available_seats: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT
        },
        image: {
            type: DataTypes.STRING
        },
        is_archived: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'events',
        timestamps: false
    });

    return Event;
};