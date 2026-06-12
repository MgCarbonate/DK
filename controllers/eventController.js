const { Event, Ticket, User, Notification, ActionLog } = require('../models/index');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { addNotification } = require('./notificationController');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/events');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'event-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только изображения!'));
        }
    }
});

// В eventController.js добавляем/заменяем функцию deleteEvent

exports.deleteEvent = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false, message: 'Доступ запрещен' });
    }

    const { event_code } = req.params;

    try {
        const event = await Event.findByPk(event_code);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Мероприятие не найдено' });
        }

        // Находим все билеты на это мероприятие с информацией о пользователях
        const tickets = await Ticket.findAll({
            where: { event_code: event_code },
            include: [{ model: User, as: 'user', attributes: ['user_code', 'full_name', 'email'] }]
        });

        console.log(`Найдено ${tickets.length} билетов на мероприятие "${event.title_short}"`);

        // Отправляем уведомления ВСЕМ пользователям, у кого были билеты
        const notifiedUsers = [];
        
        for (const ticket of tickets) {
            if (ticket.user && ticket.user.user_code) {
                // Формируем сообщение о возврате
                const notificationTitle = '❌ Мероприятие отменено';
                const notificationDescription = `Мероприятие "${event.title_short}" (${event.event_type}) отменено администратором. Ваш билет на ${ticket.quantity} шт. аннулирован. Средства в размере ${ticket.total_price}₽ будут возвращены на карту в течение 24 часов.`;
                
                // Отправляем уведомление
                await addNotification(ticket.user.user_code, notificationTitle, notificationDescription);
                
                // Логируем действие пользователя
                await logAction(ticket.user.user_code, `Возврат средств за отмену мероприятия: ${event.title_short} (${ticket.quantity} шт., ${ticket.total_price}₽)`);
                
                notifiedUsers.push(ticket.user.user_code);
                console.log(`Уведомление отправлено пользователю ${ticket.user.full_name} (${ticket.user.email})`);
            }
        }

        // Удаляем все билеты, связанные с мероприятием
        const deletedTickets = await Ticket.destroy({ where: { event_code: event_code } });
        console.log(`Удалено ${deletedTickets} билетов`);

        // Удаляем само мероприятие
        await event.destroy();

        // Логируем действие админа
        await logAction(req.session.user.user_code, `Удаление мероприятия "${event.title_short}" (возвращено ${notifiedUsers.length} билетов ${notifiedUsers.length} пользователям)`);

        res.json({ 
            success: true, 
            message: `Мероприятие "${event.title_short}" удалено. Возвращено ${tickets.length} билетов ${notifiedUsers.length} пользователям.`,
            ticketsReturned: tickets.length,
            usersNotified: notifiedUsers.length
        });
        
    } catch (error) {
        console.error('Ошибка при удалении:', error);
        res.status(500).json({ success: false, message: 'Ошибка при удалении мероприятия' });
    }
};

async function logAction(userCode, action) {
    try {
        await ActionLog.create({ user_code: userCode, action });
    } catch (error) {
        console.error('Ошибка логирования:', error);
    }
}
// Добавьте эту функцию в eventController.js
exports.getCurrentEventsCount = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    
    try {
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
        
        // Только мероприятия, которые еще не истекли (не в архиве по времени)
        const currentEvents = allEvents.filter(event => !event.is_archived && !isEventExpiredForUsers(event));
        
        res.json({ success: true, count: currentEvents.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

// Функция проверки, прошло ли более 2 часов с начала мероприятия (для скрытия от пользователей)
function isEventExpiredForUsers(event) {
    if (!event || !event.date || !event.time) return true;
    
    const now = new Date();
    const eventDate = new Date(event.date);
    const [hours, minutes] = event.time.split(':');
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const expireTime = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 часа
    
    return now > expireTime;
}

// Функция проверки, можно ли архивировать вручную (прошло 2 часа)
function canArchiveManually(event) {
    if (!event || !event.date || !event.time) return false;
    
    const now = new Date();
    const eventDate = new Date(event.date);
    const [hours, minutes] = event.time.split(':');
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const manualArchiveTime = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 часа
    
    return now > manualArchiveTime;
}

// Функция проверки, что дата и время не в прошлом
function isEventInPast(eventDate, eventTime) {
    const now = new Date();
    const dateTime = new Date(eventDate);
    const [hours, minutes] = eventTime.split(':');
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return dateTime < now;
}

async function notifyAllUsersAboutNewEvent(eventData) {
    try {
        const users = await User.findAll({
            where: {
                is_verified: true,
                is_admin: false
            },
            attributes: ['user_code']
        });

        if (users.length === 0) {
            console.log('Нет пользователей для отправки уведомлений');
            return;
        }

        const formattedDate = new Date(eventData.date).toLocaleDateString('ru-RU');
        
        const notifications = users.map(user => ({
            user_code: user.user_code,
            title: '🎉 Новое мероприятие!',
            description: `"${eventData.title_short}" — ${eventData.event_type}. ${formattedDate} в ${eventData.time}. Билеты уже в продаже!`,
            created_at: new Date(),
            is_read: false
        }));

        await Notification.bulkCreate(notifications);
        console.log(`✅ Уведомления о новом мероприятии отправлены ${notifications.length} пользователям`);
    } catch (error) {
        console.error('Ошибка при отправке уведомлений о новом мероприятии:', error);
    }
}

// СТРАНИЦА МЕРОПРИЯТИЙ - для клиента (скрываем через 2 часа)
exports.getEvents = async (req, res) => {
    try {
        const allEvents = await Event.findAll({
            where: { available_seats: { [Op.gt]: 0 } },
            order: [['date', 'ASC']]
        });
        
        // Все пользователи (включая админа) видят только мероприятия, с начала которых прошло МЕНЕЕ 2 часов
        const events = allEvents.filter(event => !isEventExpiredForUsers(event));
        
        const formattedEvents = events.map(event => ({
            ...event.toJSON(),
            formatted_date: new Date(event.date).toLocaleDateString('ru-RU')
        }));
        
        res.render('events', { events: formattedEvents, currentPage: 'events' });
    } catch (error) {
        console.error(error);
        res.render('events', { events: [], currentPage: 'events' });
    }
};

// API для получения мероприятий (для страницы мероприятий - скрываем через 2 часа)
exports.getAllEvents = async (req, res) => {
    try {
        const allEvents = await Event.findAll({
            where: { available_seats: { [Op.gt]: 0 } },
            attributes: ['event_code', 'title_full', 'title_short', 'curator', 'event_type', 'date', 'time', 'price', 'total_seats', 'available_seats', 'description', 'image'],
            order: [['date', 'ASC']]
        });
        
        // Все пользователи (включая админа) получают только мероприятия, с начала которых прошло МЕНЕЕ 2 часов
        const events = allEvents.filter(event => !isEventExpiredForUsers(event));
        
        res.json({ success: true, events });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки мероприятий' });
    }
};

// API для админа - ВСЕ мероприятия (архивные тоже видны)
exports.getAllEventsForAdmin = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false, message: 'Доступ запрещен' });
    }
    
    try {
        const events = await Event.findAll({
            attributes: ['event_code', 'title_full', 'title_short', 'curator', 'event_type', 'date', 'time', 'price', 'total_seats', 'available_seats', 'description', 'image', 'is_archived'],
            order: [['date', 'ASC']]
        });
        res.json({ success: true, events });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки мероприятий' });
    }
};

// Ручная архивация мероприятия админом (доступна через 2 часа)
exports.archiveEvent = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false, message: 'Доступ запрещен' });
    }

    const { event_code } = req.params;

    try {
        const event = await Event.findByPk(event_code);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Мероприятие не найдено' });
        }

        // Проверяем, прошло ли 2 часа
        if (!canArchiveManually(event)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Нельзя переместить в архив. Должно пройти 2 часа с начала мероприятия.' 
            });
        }

        // Ставим флаг архивации
        await event.update({
            is_archived: true
        });

        await ActionLog.create({
            user_code: req.session.user.user_code,
            action: `Мероприятие "${event.title_short}" перемещено в архив`
        });

        res.json({ success: true, message: 'Мероприятие перемещено в архив' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при архивации' });
    }
};

// Получение одного мероприятия по ID
exports.getEventById = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);

        if (!event) {
            return res.status(404).json({ success: false, error: 'Мероприятие не найдено' });
        }
        
        const isExpired = isEventExpiredForUsers(event);
        if (isExpired && (!req.session.user || !req.session.user.is_admin)) {
            return res.status(400).json({ success: false, error: 'Мероприятие уже прошло' });
        }

        res.json({
            success: true,
            event: {
                event_code: event.event_code,
                title_full: event.title_full,
                title_short: event.title_short,
                curator: event.curator,
                event_type: event.event_type,
                date: new Date(event.date).toLocaleDateString('ru-RU'),
                time: event.time,
                price: event.price,
                total_seats: event.total_seats,
                available_seats: event.available_seats,
                description: event.description,
                image: event.image
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
};

exports.uploadEventImage = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false, message: 'Доступ запрещен' });
    }

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Файл не загружен' });
        }

        const imagePath = '/uploads/events/' + req.file.filename;
        res.json({ success: true, imagePath: imagePath });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки фото' });
    }
};

exports.addEvent = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false, message: 'Доступ запрещен' });
    }

    const { title_full, title_short, curator, event_type, date, time, price, total_seats, description, image } = req.body;

    if (isEventInPast(date, time)) {
        return res.status(400).json({ success: false, message: 'Нельзя создать мероприятие в прошлом' });
    }

    try {
        const event = await Event.create({
            title_full,
            title_short,
            curator,
            event_type,
            date: new Date(date),
            time,
            price: parseFloat(price),
            total_seats: parseInt(total_seats),
            available_seats: parseInt(total_seats),
            description,
            image: image || null,
            is_archived: false
        });

        await notifyAllUsersAboutNewEvent(event);

        res.json({ success: true, message: 'Мероприятие добавлено', event });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при добавлении' });
    }
};

exports.updateEvent = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false, message: 'Доступ запрещен' });
    }

    const { event_code } = req.params;
    const { title_full, title_short, curator, event_type, date, time, price, total_seats, description, image } = req.body;

    if (isEventInPast(date, time)) {
        return res.status(400).json({ success: false, message: 'Нельзя установить дату и время в прошлом' });
    }

    try {
        const event = await Event.findByPk(event_code);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Мероприятие не найдено' });
        }

        await event.update({
            title_full,
            title_short,
            curator,
            event_type,
            date: new Date(date),
            time,
            price: parseFloat(price),
            total_seats: parseInt(total_seats),
            available_seats: parseInt(total_seats),
            description,
            image: image || event.image
        });

        res.json({ success: true, message: 'Мероприятие обновлено', event });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при обновлении' });
    }
};


exports.upload = upload;