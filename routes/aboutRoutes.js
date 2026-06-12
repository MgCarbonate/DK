const express = require('express');
const router = express.Router();
const aboutController = require('../controllers/aboutController');

// Страница "О нас"
router.get('/about', (req, res) => {
    res.render('about', {
        user: req.session.user || null,
        currentPage: 'about'
    });
});

// Публичные API для страницы "О нас" (не требуют авторизации)
router.get('/api/about/staff', aboutController.getStaff);
router.get('/api/about/settings', aboutController.getSettings);

module.exports = router;