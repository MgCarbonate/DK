const express = require('express');
const router = express.Router();
const { Event, Card, Ticket, User, ActionLog } = require('../models/index');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { addNotification } = require('../controllers/notificationController');

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

async function logAction(userCode, action) {
    try {
        await ActionLog.create({ user_code: userCode, action });
    } catch (error) {
        console.error('Ошибка логирования:', error);
    }
}

// ==================== СТРАНИЦЫ ====================
// Страница корзины (без параметра event)
router.get('/buy-ticket', requireAuth, async (req, res) => {
    res.render('buy-ticket', {
        user: req.session.user,
        currentPage: 'buy-ticket'  // изменили с 'events' на 'buy-ticket'
    });
});

router.get('/buy-ticket/add', requireAuth, async (req, res) => {
    const eventCode = req.query.event;
    if (!eventCode) return res.redirect('/buy-ticket');

    try {
        const event = await Event.findByPk(eventCode);
        if (!event) return res.redirect('/buy-ticket');

        res.render('buy-ticket', {
            user: req.session.user,
            event: event.toJSON(),
            currentPage: 'buy-ticket'  // изменили с 'events' на 'buy-ticket'
        });
    } catch (error) {
        console.error(error);
        res.redirect('/buy-ticket');
    }
});

router.get('/payment', requireAuth, async (req, res) => {
    const { event_code, quantity, total_price } = req.query;

    if (!event_code || !quantity || !total_price) {
        return res.redirect('/events');
    }

    try {
        const event = await Event.findByPk(event_code);
        if (!event) {
            return res.redirect('/events');
        }

        const cards = await Card.findAll({
            where: { user_code: req.session.user.user_code }
        });

        res.render('payment', {
            user: req.session.user,
            event: event.toJSON(),
            quantity: parseInt(quantity),
            total_price: parseFloat(total_price),
            cards: cards,
            currentPage: 'events'  // ДОБАВИТЬ ЭТУ СТРОКУ
        });
    } catch (error) {
        console.error(error);
        res.redirect('/events');
    }
});

// ==================== API ====================
router.get('/api/events/list', requireAuth, async (req, res) => {
    try {
        const now = new Date();
        const allEvents = await Event.findAll({
            where: { available_seats: { [Op.gt]: 0 } },
            attributes: ['event_code', 'title_full', 'title_short', 'event_type', 'price', 'available_seats', 'date', 'time'],
            order: [['date', 'ASC']]
        });
        
        // Фильтруем только актуальные мероприятия
        const events = allEvents.filter(event => {
            const eventDateTime = new Date(event.date);
            const [hours, minutes] = event.time.split(':');
            eventDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            const expireTime = new Date(eventDateTime.getTime() + 2 * 60 * 60 * 1000);
            return now <= expireTime;
        });

        const formattedEvents = events.map(event => ({
            event_code: event.event_code,
            title_full: event.title_full,
            title_short: event.title_short,
            event_type: event.event_type,
            price: event.price,
            available_seats: event.available_seats,
            date: new Date(event.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
            time: event.time
        }));

        res.json({ success: true, events: formattedEvents });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки мероприятий' });
    }
});

router.get('/api/events/:id', requireAuth, async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Мероприятие не найдено' });
        }

        res.json({
            success: true,
            event: {
                event_code: event.event_code,
                title_full: event.title_full,
                title_short: event.title_short,
                curator: event.curator,
                event_type: event.event_type,
                date: new Date(event.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
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
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

router.get('/api/cards', requireAuth, async (req, res) => {
    try {
        const cards = await Card.findAll({
            where: { user_code: req.session.user.user_code },
            attributes: ['card_code', 'card_number', 'expiry_date']
        });
        res.json({ success: true, cards: cards });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки карт' });
    }
});

router.post('/api/cards', requireAuth, async (req, res) => {
    const { card_number, expiry_date, cvv } = req.body;

    if (!card_number || card_number.length !== 16) {
        return res.status(400).json({ success: false, message: 'Неверный номер карты' });
    }
    if (!expiry_date || !/^\d{2}\/\d{2}$/.test(expiry_date)) {
        return res.status(400).json({ success: false, message: 'Неверный срок действия' });
    }
    if (!cvv || cvv.length !== 3) {
        return res.status(400).json({ success: false, message: 'Неверный CVV' });
    }

    try {
        const cardsCount = await Card.count({ where: { user_code: req.session.user.user_code } });
        if (cardsCount >= 5) {
            return res.status(400).json({ success: false, message: 'Нельзя добавить более 5 карт' });
        }

        const existingCard = await Card.findOne({
            where: {
                card_number: card_number.replace(/\s/g, ''),
                user_code: req.session.user.user_code
            }
        });
        if (existingCard) {
            return res.status(400).json({ success: false, message: 'Эта карта уже добавлена' });
        }

        const hashedCvv = await bcrypt.hash(cvv, 10);

        const newCard = await Card.create({
            card_number: card_number.replace(/\s/g, ''),
            expiry_date,
            cvv: hashedCvv,
            user_code: req.session.user.user_code
        });

        await logAction(req.session.user.user_code, `Новая карта ${card_number.slice(-4)} (${expiry_date})`);
        await addNotification(req.session.user.user_code, 'Добавление карты', `**** ${card_number.slice(-4)}`);

        res.json({
            success: true,
            message: 'Карта добавлена',
            card: {
                card_code: newCard.card_code,
                card_number: newCard.card_number,
                expiry_date: newCard.expiry_date
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при добавлении карты' });
    }
});

router.post('/api/payment/process-multiple', requireAuth, async (req, res) => {
    const { cart, card_code } = req.body;

    try {
        let totalTickets = 0;
        let totalAmount = 0;
        let eventsList = [];

        for (const item of cart) {
            let event = await Event.findByPk(item.event_code);

            if (!event) {
                return res.status(404).json({ success: false, message: `Мероприятие не найдено` });
            }

            if (event.available_seats < item.quantity) {
                return res.status(400).json({ success: false, message: `Недостаточно мест на мероприятие "${event.title_short}"` });
            }

            await Event.update(
                { available_seats: event.available_seats - item.quantity },
                { where: { event_code: item.event_code } }
            );

            await Ticket.create({
                user_code: req.session.user.user_code,
                event_code: item.event_code,
                quantity: item.quantity,
                total_price: event.price * item.quantity,
                purchase_date: new Date()
            });

            totalTickets += item.quantity;
            totalAmount += event.price * item.quantity;
            eventsList.push(`${event.title_short} (${item.quantity} шт.)`);
        }

        await logAction(req.session.user.user_code, `Покупка билетов ${totalTickets} шт.`);

        // Уведомление о покупке
        await addNotification(req.session.user.user_code, 'Покупка билетов', `${eventsList.join(', ')} | Итого: ${totalAmount}₽`);

        res.json({ success: true, message: 'Оплата прошла успешно!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при оплате' });
    }
});

module.exports = router;