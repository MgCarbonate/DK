const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../dom_kultur.db'),
    logging: false
});

const User = require('./User')(sequelize);
const Card = require('./Card')(sequelize);
const Event = require('./Event')(sequelize);
const Ticket = require('./Ticket')(sequelize);
const ActionLog = require('./ActionLog')(sequelize);
const VerificationCode = require('./VerificationCode')(sequelize);
const Notification = require('./Notification')(sequelize);
const SotrudApplication = require('./SotrudApplication')(sequelize);
const Staff = require('./Staff')(sequelize);
const AboutSettings = require('./AboutSettings')(sequelize);


// Добавьте ассоциации если нужно
User.hasMany(SotrudApplication, { foreignKey: 'user_code', as: 'sotrud_applications' });
SotrudApplication.belongsTo(User, { foreignKey: 'user_code', as: 'user' });


User.hasMany(Card, { foreignKey: 'user_code', as: 'cards' });
Card.belongsTo(User, { foreignKey: 'user_code', as: 'user' });

User.hasMany(Ticket, { foreignKey: 'user_code', as: 'tickets' });
Ticket.belongsTo(User, { foreignKey: 'user_code', as: 'user' });

Event.hasMany(Ticket, { foreignKey: 'event_code', as: 'tickets' });
Ticket.belongsTo(Event, { foreignKey: 'event_code', as: 'event' });

User.hasMany(ActionLog, { foreignKey: 'user_code', as: 'actions' });
ActionLog.belongsTo(User, { foreignKey: 'user_code', as: 'user' });

User.hasMany(Notification, { foreignKey: 'user_code', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_code', as: 'user' });

module.exports = {
    sequelize,
    User,
    Card,
    Event,
    Ticket,
    ActionLog,
    VerificationCode,
    Notification,
    SotrudApplication,
    Staff,           
    AboutSettings
};