const { Notification } = require('../models/index');

// Добавление уведомления
async function addNotification(userCode, title, description) {
    try {
        const count = await Notification.count({ where: { user_code: userCode } });
        if (count >= 50) {
            const oldest = await Notification.findOne({
                where: { user_code: userCode },
                order: [['created_at', 'ASC']]
            });
            if (oldest) await oldest.destroy();
        }

        await Notification.create({
            user_code: userCode,
            title: title,
            description: description || '',
            is_read: false,
            created_at: new Date()
        });

        console.log(`Уведомление создано для пользователя ${userCode}: ${title}`);
    } catch (error) {
        console.error('Ошибка добавления уведомления:', error);
    }
}

// Получение уведомлений пользователя
const getNotifications = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });

    try {
        const notifications = await Notification.findAll({
            where: { user_code: req.session.user.user_code },
            order: [['created_at', 'DESC']],
            limit: 50
        });

        const unreadCount = await Notification.count({
            where: { user_code: req.session.user.user_code, is_read: false }
        });

        res.json({ success: true, notifications, unreadCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

// Получение количества непрочитанных уведомлений
const getUnreadCount = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });

    try {
        const unreadCount = await Notification.count({
            where: { user_code: req.session.user.user_code, is_read: false }
        });
        res.json({ success: true, unreadCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

// Отметить как прочитанные
const markAsRead = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });

    try {
        await Notification.update(
            { is_read: true },
            { where: { user_code: req.session.user.user_code, is_read: false } }
        );
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

// Удалить одно уведомление
const deleteNotification = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });

    const { notification_code } = req.params;
    try {
        await Notification.destroy({
            where: { notification_code, user_code: req.session.user.user_code }
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

module.exports = {
    addNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    deleteNotification
};