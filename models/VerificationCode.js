const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const VerificationCode = sequelize.define('VerificationCode', {
        code_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        code: {
            type: DataTypes.STRING(6),
            allowNull: false
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        used: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'verification_codes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    return VerificationCode;
};