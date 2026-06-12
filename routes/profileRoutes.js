const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const notificationController = require('../controllers/notificationController');

const requireAuth = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

router.get('/profile', requireAuth, profileController.getProfile);
router.post('/profile/edit', requireAuth, profileController.editProfile);
router.post('/profile/change-password', requireAuth, profileController.changePassword);
router.post('/profile/add-card', requireAuth, profileController.addCard);
router.put('/api/cards/:cardCode', requireAuth, profileController.updateCard);
router.delete('/api/cards/:cardCode', requireAuth, profileController.deleteCard);
router.post('/api/tickets/:ticketCode/return', requireAuth, profileController.returnTicket);
router.get('/api/cards', requireAuth, profileController.getCards);

router.post('/profile/request-email-change', requireAuth, profileController.requestEmailChange);
router.post('/profile/confirm-email-change', requireAuth, profileController.confirmEmailChange);

// Уведомления
router.get('/api/notifications', requireAuth, notificationController.getNotifications);
router.get('/api/notifications/unread-count', requireAuth, notificationController.getUnreadCount);
router.post('/api/notifications/mark-read', requireAuth, notificationController.markAsRead);
router.delete('/api/notifications/:notification_code', requireAuth, notificationController.deleteNotification);

module.exports = router;