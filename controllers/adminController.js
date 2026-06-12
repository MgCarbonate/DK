const { User, Card, Event, Ticket, ActionLog, VerificationCode } = require('../models/index');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { sendEmailChangeCode } = require('../services/emailService');
const activeUsers = require('../services/activeUsersMemory');


async function logAction(userCode, action) {
    try {
        await ActionLog.create({ user_code: userCode, action });
    } catch (error) {
        console.error('Ошибка логирования:', error);
    }
}

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// В adminController.js заменяем функцию getStatistics

exports.getStatistics = async (req, res) => {
    const { SotrudApplication, Event } = require('../models/index');
    
    if (!req.session.user || !req.session.user.is_admin) {
        return res.redirect('/');
    }
    try {
        const totalUsers = await User.count();
        
        // Получаем реальное количество активных пользователей из памяти
        const activeUsersCount = activeUsers.getActiveUsersCount();
        
        // Подсчитываем ТОЛЬКО ТЕКУЩИЕ мероприятия
        const allEvents = await Event.findAll();
        
        function isEventExpiredForUsers(event) {
            if (!event || !event.date || !event.time) return true;
            const now = new Date();
            const eventDate = new Date(event.date);
            const [hours, minutes] = event.time.split(':');
            eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            const expireTime = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
            return now > expireTime;
        }
        
        const totalEvents = allEvents.filter(event => !event.is_archived && !isEventExpiredForUsers(event)).length;
        
        const totalApplications = await SotrudApplication.count();

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const { count, rows: logs } = await ActionLog.findAndCountAll({
            include: [{ model: User, as: 'user', attributes: ['full_name'] }],
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        const totalPages = Math.ceil(count / limit);

        const formattedLogs = logs.map(log => ({
            action_code: log.action_code,
            created_at: new Date(log.created_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            action: log.action,
            user_name: log.user ? log.user.full_name : 'Пользователь'
        }));

        // Для отладки (можно удалить после проверки)
        const stats = activeUsers.getActiveStats();
        console.log('Активные пользователи:', activeUsersCount, 'Сессий:', stats.total_sessions);

        res.render('adminstat', {
            user: req.session.user,
            totalUsers,
            activeUsers: activeUsersCount,  // Теперь здесь реальные активные пользователи!
            totalEvents,
            logs: formattedLogs,
            currentPage: 'admin',
            adminPage: 'statistics',
            totalApplications: totalApplications,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                prevPage: page - 1,
                nextPage: page + 1
            }
        });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};

exports.getUsersPage = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.redirect('/');
    }
    res.render('admin-users', {
        user: req.session.user,
        currentPage: 'admin',        // ИСПРАВЛЕНО: было headerPage
        adminPage: 'users'
    });
};

exports.getEventsPage = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.redirect('/');
    }
    res.render('admin-events', {
        user: req.session.user,
        currentPage: 'admin',        // ИСПРАВЛЕНО: было headerPage
        adminPage: 'events'
    });
};

exports.getEventsStatsPage = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.redirect('/');
    }
    res.render('admin-events-stats', {
        user: req.session.user,
        currentPage: 'admin',        // ИСПРАВЛЕНО: было headerPage
        adminPage: 'events-stats'
    });
};

exports.searchLogs = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false, message: 'Доступ запрещен' });
    }
    const { query } = req.query;
    if (!query || query.trim() === '') {
        return res.json({ success: true, logs: [] });
    }
    try {
        const logs = await ActionLog.findAll({
            where: { action: { [Op.like]: `%${query}%` } },
            include: [{ model: User, as: 'user', attributes: ['full_name'] }],
            order: [['created_at', 'DESC']],
            limit: 50
        });
        const formattedLogs = logs.map(log => ({
            action_code: log.action_code,
            created_at: new Date(log.created_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            action: log.action,
            user_name: log.user ? log.user.full_name : 'Пользователь'
        }));
        res.json({ success: true, logs: formattedLogs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка поиска' });
    }
};
exports.getUsers = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    try {
        const users = await User.findAll({
            where: { is_admin: false }, // Добавлено: исключаем админов
            attributes: ['user_code', 'full_name', 'email', 'is_verified', 'is_admin'],
            order: [['user_code', 'ASC']]
        });
        res.json({ success: true, users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};
exports.getUsersPaginated = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    
    try {
        let whereCondition = { is_admin: false };
        if (search) {
            whereCondition = {
                is_admin: false,
                [Op.or]: [
                    { full_name: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } }
                ]
            };
        }
        
        const { count, rows: users } = await User.findAndCountAll({
            where: whereCondition,
            attributes: ['user_code', 'full_name', 'email', 'is_verified', 'is_admin'],
            order: [['user_code', 'ASC']],
            limit: limit,
            offset: offset
        });
        
        const totalPages = Math.ceil(count / limit);
        
        res.json({
            success: true,
            users: users,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                total: count,
                hasPrev: page > 1,
                hasNext: page < totalPages
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

exports.updateUser = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    const { user_code } = req.params;
    const { email } = req.body;

    try {
        const user = await User.findByPk(user_code);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }
        if (user.is_admin) {
            return res.status(400).json({ success: false, message: 'Нельзя изменить email администратора' });
        }

        if (email === user.email) {
            return res.status(400).json({ success: false, message: 'Новый email совпадает с текущим' });
        }

        const existingUser = await User.findOne({
            where: { email: email, user_code: { [Op.ne]: user_code } }
        });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email уже используется' });
        }

        await VerificationCode.destroy({ where: { email: email, used: false } });

        const code = generateCode();
        const expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + 10);

        await VerificationCode.create({
            email: email,
            code,
            expires_at,
            used: false
        });

        const emailResult = await sendEmailChangeCode(email, code, user.email);
        if (!emailResult.success) {
            return res.status(500).json({ success: false, message: 'Не удалось отправить код на новый email' });
        }

        req.session.pendingEmailChange = {
            user_code: user.user_code,
            new_email: email,
            old_email: user.email,
            user_name: user.full_name
        };

        res.json({
            success: true,
            message: 'Код подтверждения отправлен на новый email. Введите код для завершения.',
            requiresVerification: true
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при отправке кода' });
    }
};

exports.confirmEmailChange = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }

    const { code } = req.body;
    const pendingData = req.session.pendingEmailChange;

    if (!pendingData) {
        return res.status(400).json({ success: false, message: 'Нет ожидающей смены email. Сначала измените email пользователя.' });
    }

    try {
        const verificationCode = await VerificationCode.findOne({
            where: {
                email: pendingData.new_email,
                code: code,
                used: false,
                expires_at: { [Op.gt]: new Date() }
            }
        });

        if (!verificationCode) {
            return res.status(400).json({ success: false, message: 'Неверный или просроченный код' });
        }

        await verificationCode.update({ used: true });

        await User.update(
            { email: pendingData.new_email },
            { where: { user_code: pendingData.user_code } }
        );

        await logAction(req.session.user.user_code, `Изменение email пользователя ${pendingData.user_name} на ${pendingData.new_email}`);

        delete req.session.pendingEmailChange;

        res.json({ success: true, message: 'Email успешно изменен!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при подтверждении' });
    }
};

exports.deleteUser = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    const { user_code } = req.params;
    const { type } = req.body;
    try {
        const user = await User.findByPk(user_code);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }
        if (user.is_admin) {
            return res.status(400).json({ success: false, message: 'Нельзя удалить администратора' });
        }

        await Ticket.destroy({ where: { user_code: user_code } });
        await Card.destroy({ where: { user_code: user_code } });
        await ActionLog.destroy({ where: { user_code: user_code } });
        await User.destroy({ where: { user_code: user_code } });

        const deleteType = type === 'permanent' ? 'Перманентное удаление' : 'Единоразовое удаление';
        await logAction(req.session.user.user_code, `${deleteType} пользователя ${user.full_name}`);
        res.json({ success: true, message: 'Пользователь удален' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

exports.getOrdersStats = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }

    try {
        const tickets = await Ticket.findAll({
            include: [
                { model: Event, as: 'event', attributes: ['title_full'] },
                { model: User, as: 'user', attributes: ['full_name'] }
            ],
            order: [['purchase_date', 'DESC']]
        });

        const orders = [];
        for (const ticket of tickets) {
            const card = await Card.findOne({
                where: { user_code: ticket.user_code },
                order: [['card_code', 'DESC']],
                attributes: ['card_number', 'expiry_date']
            });

            orders.push({
                event_title: ticket.event ? ticket.event.title_full : 'Мероприятие удалено',
                user_name: ticket.user ? ticket.user.full_name : 'Пользователь удален',
                quantity: ticket.quantity,
                total_price: ticket.total_price,
                card_number: card ? card.card_number : null,
                expiry_date: card ? card.expiry_date : null
            });
        }

        res.json({ success: true, orders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки статистики' });
    }
};