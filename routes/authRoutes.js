const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/register', authController.getRegister);
router.post('/auth/register', authController.postRegister);
router.post('/auth/verify-code', authController.verifyCode);
router.post('/auth/resend-code', authController.resendCode);
router.get('/logout', authController.logout);

// Маршруты для восстановления пароля (API для модального окна)
router.post('/auth/forgot-password', authController.sendResetCode);
router.post('/auth/verify-reset-code', authController.verifyResetCode);
router.post('/auth/resend-reset-code', authController.resendResetCode);
router.post('/auth/reset-password', authController.resetPassword);

module.exports = router;