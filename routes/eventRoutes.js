const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// Для обычных пользователей (и админа на странице мероприятий)
router.get('/events', eventController.getEvents);
router.get('/api/events/all', eventController.getAllEvents);

// Для админ-панели (только для админа)
router.get('/api/events/admin/all', eventController.getAllEventsForAdmin);
router.post('/api/events', eventController.addEvent);
router.put('/api/events/:event_code', eventController.updateEvent);
router.delete('/api/events/:event_code', eventController.deleteEvent);
router.post('/api/events/upload-image', eventController.upload.single('image'), eventController.uploadEventImage);
router.put('/api/events/archive/:event_code', eventController.archiveEvent);
router.get('/api/events/:id', eventController.getEventById);

module.exports = router;