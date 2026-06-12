const express = require('express');
const router = express.Router();
const aboutAdminController = require('../controllers/aboutAdminController');

const requireAdmin = (req, res, next) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.redirect('/');
    }
    next();
};

// Страница управления (только для админа)
router.get('/admin/about', requireAdmin, aboutAdminController.getAboutAdmin);

// API для баннера (только для админа)
router.post('/admin/api/about/upload-banner', requireAdmin, aboutAdminController.uploadBannerMiddleware, aboutAdminController.uploadBanner);
router.put('/admin/api/about/banner-text', requireAdmin, aboutAdminController.updateBannerText);

// API для сотрудников (только для админа)
router.get('/admin/api/about/staff', requireAdmin, aboutAdminController.getStaff);
router.put('/admin/api/about/staff/:staff_code', requireAdmin, aboutAdminController.updateStaff);
router.post('/admin/api/about/staff/upload-photo', requireAdmin, aboutAdminController.uploadStaffPhotoMiddleware, aboutAdminController.uploadStaffPhoto);

// ПУБЛИЧНЫЙ маршрут для страницы "О нас" (НЕ требует авторизации)
router.get('/api/about/staff', aboutAdminController.getStaff);
router.get('/api/about/settings', aboutAdminController.getAboutSettings);

module.exports = router;