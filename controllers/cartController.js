const { Event, Card, Ticket, User, ActionLog } = require('../models/index');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { addNotification } = require('./notificationController');

async function logAction(userCode, action) {
    try {
        await ActionLog.create({ user_code: userCode, action });
    } catch (error) {
        console.error('Ошибка логирования:', error);
    }
}

function isCardExpired(expiryDate) {
    const match = expiryDate.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return true;
    const month = parseInt(match[1], 10);
    let year = parseInt(match[2], 10);
    year = 2000 + year;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear) return true;
    if (year === currentYear && month < currentMonth) return true;
    return false;
}

exports.getBuyTicket = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const eventCode = req.query.event;
    if (!eventCode) return res.redirect('/events');
    try {
        const event = await Event.findByPk(eventCode);
        if (!event) return res.redirect('/events');
        const cards = await Card.findAll({ where: { user_code: req.session.user.user_code } });
        res.render('buy-ticket', { event: event.toJSON(), cards: cards, user: req.session.user });
    } catch (error) {
        console.error(error);
        res.redirect('/events');
    }
};

exports.getPayment = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { event_code, quantity, total_price } = req.query;
    try {
        const event = await Event.findByPk(event_code);
        const cards = await Card.findAll({ where: { user_code: req.session.user.user_code } });
        res.render('payment', {
            event: event.toJSON(),
            quantity: parseInt(quantity),
            total_price: parseFloat(total_price),
            cards: cards,
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.redirect('/events');
    }
};

exports.addCardFromPayment = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    const { card_number, expiry_date, cvv } = req.body;
    if (!card_number || card_number.length !== 16) {
        return res.status(400).json({ success: false, message: 'Неверный номер карты' });
    }
    if (!expiry_date || !/^\d{2}\/\d{2}$/.test(expiry_date)) {
        return res.status(400).json({ success: false, message: 'Неверный срок действия' });
    }
    if (isCardExpired(expiry_date)) {
        return res.status(400).json({ success: false, message: 'Срок действия карты истек' });
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
            where: { card_number: card_number.replace(/\s/g, ''), user_code: req.session.user.user_code }
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

        res.json({ success: true, message: 'Карта добавлена', card: { card_code: newCard.card_code, card_number: newCard.card_number, expiry_date: newCard.expiry_date } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при добавлении карты' });
    }
};
exports.processPayment = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    const { event_code, quantity, total_price, card_code } = req.body;
    try {
        console.log('processPayment вызван, event_code:', event_code);

        const event = await Event.findByPk(event_code);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Мероприятие не найдено' });
        }
        if (event.available_seats < quantity) {
            return res.status(400).json({ success: false, message: 'Недостаточно мест' });
        }
        const card = await Card.findOne({ where: { card_code: card_code, user_code: req.session.user.user_code } });
        if (!card) {
            return res.status(400).json({ success: false, message: 'Карта не найдена' });
        }
        const ticket = await Ticket.create({
            user_code: req.session.user.user_code,
            event_code: event_code,
            quantity: quantity,
            total_price: total_price,
            purchase_date: new Date()
        });
        await Event.update({ available_seats: event.available_seats - quantity }, { where: { event_code: event_code } });
        await logAction(req.session.user.user_code, `Покупка билета ${quantity} шт.`);

        console.log('Добавляем уведомление о покупке...');
        await addNotification(req.session.user.user_code, 'Покупка билета', `${event.title_short}, ${quantity} шт., ${total_price}₽`);
        console.log('Уведомление добавлено');

        res.json({ success: true, message: 'Оплата прошла успешно!', ticket_code: ticket.ticket_code });
    } catch (error) {
        console.error('Ошибка в processPayment:', error);
        res.status(500).json({ success: false, message: 'Ошибка при оплате' });
    }
};


exports.processPaymentMultiple = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
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
        await addNotification(req.session.user.user_code, 'Покупка билетов', `${eventsList.join(', ')} | Итого: ${totalAmount}₽`);

        res.json({ success: true, message: 'Оплата прошла успешно!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при оплате' });
    }
};
exports.getEventsForCart = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    try {
        const now = new Date();
        const allEvents = await Event.findAll({
            where: { available_seats: { [Op.gt]: 0 } },
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
        
        res.json({ success: true, events });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки мероприятий' });
    }
};