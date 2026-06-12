const activeUsers = require('../services/activeUsersMemory');

async function trackActivity(req, res, next) {
    // Обновляем активность после того, как ответ отправлен клиенту
    res.on('finish', () => {
        if (req.session && req.session.user && req.session.user.user_code && req.sessionID) {
            activeUsers.updateUserActivity(
                req.sessionID,
                req.session.user.user_code,
                {
                    full_name: req.session.user.full_name,
                    email: req.session.user.email,
                    ip: req.ip || req.connection?.remoteAddress
                }
            );
        }
    });
    
    next();
}

module.exports = trackActivity;