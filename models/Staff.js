const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Staff = sequelize.define('Staff', {
        staff_code: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        position: {
            type: DataTypes.STRING,
            allowNull: false
        },
        photo: {
            type: DataTypes.STRING,
            defaultValue: '/img/about-empl.png'
        },
        order_index: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        tableName: 'staff',
        timestamps: false
    });

    return Staff;
};