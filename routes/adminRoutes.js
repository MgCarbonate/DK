const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const sotrudController = require('../controllers/sotrudController');
const eventController = require('../controllers/eventController');

const requireAdmin = (req, res, next) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.redirect('/');
    }
    next();
};

router.get('/admin/statistics', requireAdmin, adminController.getStatistics);
router.get('/admin/users', requireAdmin, adminController.getUsersPage);
router.get('/admin/events', requireAdmin, adminController.getEventsPage);
router.get('/admin/events-stats', requireAdmin, adminController.getEventsStatsPage);
router.get('/admin/api/logs/search', requireAdmin, adminController.searchLogs);
router.get('/admin/api/users', requireAdmin, adminController.getUsers);
router.get('/admin/api/orders/stats', requireAdmin, adminController.getOrdersStats);
router.put('/admin/api/users/:user_code', requireAdmin, adminController.updateUser);
router.post('/admin/api/users/confirm-email', requireAdmin, adminController.confirmEmailChange);
router.delete('/admin/api/users/:user_code', requireAdmin, adminController.deleteUser);
router.get('/admin/api/users/paginated', requireAdmin, adminController.getUsersPaginated);
router.get('/admin/api/events/current-count', requireAdmin, eventController.getCurrentEventsCount);
router.get('/admin/api/logs', requireAdmin, async (req, res) => {
    const { ActionLog, User } = require('../models/index');
    const { Op } = require('sequelize');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const query = req.query.query || '';

    try {
        let whereCondition = {};
        if (query) {
            whereCondition = {
                action: { [Op.like]: `%${query}%` }
            };
        }

        const { count, rows: logs } = await ActionLog.findAndCountAll({
            where: whereCondition,
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

        res.json({
            success: true,
            logs: formattedLogs,
            currentPage: page,
            totalPages: totalPages,
            total: count
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки' });
    }
});

// Маршруты для сотрудничества
router.get('/admin/sotrud', requireAdmin, (req, res) => {
    res.render('admin-sotrud', { 
        user: req.session.user, 
        adminPage: 'sotrud',
        currentPage: 'admin'
    });
});

router.get('/admin/api/sotrud/applications', requireAdmin, sotrudController.getApplications);
router.put('/admin/api/sotrud/applications/:application_code', requireAdmin, sotrudController.updateApplicationStatus);

module.exports = router;