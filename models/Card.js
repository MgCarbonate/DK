const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Card = sequelize.define('Card', {
        card_code: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        card_number: {
            type: DataTypes.STRING,
            allowNull: false
        },
        expiry_date: {
            type: DataTypes.STRING,
            allowNull: false
        },
        cvv: {
            type: DataTypes.STRING,
            allowNull: false
        },
        user_code: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'cards',
        timestamps: false
    });

    return Card;
};