const bcrypt = require('bcrypt');
const { User, Card, Ticket, Event, ActionLog, VerificationCode } = require('../models/index');
const { Op } = require('sequelize');
const { sendEmailChangeCode } = require('../services/emailService');
const { addNotification } = require('./notificationController');

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

function validateFullName(fullName) {
    const trimmed = fullName.trim();
    if (!trimmed) return false;
    if (/\d/.test(trimmed)) return false;
    const words = trimmed.split(/\s+/);
    if (words.length < 3) return false;
    for (const word of words) {
        if (word.length < 2) return false;
        if (!/^[А-Яа-яЁёA-Za-z\-]+$/.test(word)) return false;
    }
    return true;
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
};

exports.getProfile = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.is_admin) {
        return res.redirect('/admin/statistics');
    }
    try {
        const user = await User.findByPk(req.session.user.user_code);
        const cards = await Card.findAll({ where: { user_code: req.session.user.user_code } });
        const tickets = await Ticket.findAll({
            where: { user_code: req.session.user.user_code },
            include: [{ model: Event, as: 'event' }],
            order: [['purchase_date', 'DESC']]
        });
        
        function isEventExpired(event) {
            if (!event) return true;
            const now = new Date();
            const eventDateTime = new Date(event.date);
            const [hours, minutes] = event.time.split(':');
            eventDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            const expireTime = new Date(eventDateTime.getTime() + 2 * 60 * 60 * 1000);
            return now > expireTime;
        }
        
        const formatTicket = (ticket) => ({
            ticket_code: ticket.ticket_code,
            quantity: ticket.quantity,
            total_price: ticket.total_price,
            purchase_date: ticket.purchase_date,
            event_title: ticket.event?.title_short || 'Мероприятие',
            event_type: ticket.event?.event_type || '',
            event_date: ticket.event?.date ? new Date(ticket.event.date).toLocaleDateString('ru-RU') : '',
            event_time: ticket.event?.time || '',
            event_code: ticket.event_code
        });
        
        const formattedTickets = tickets.map(formatTicket);
        const activeTickets = tickets.filter(ticket => ticket.event && !isEventExpired(ticket.event)).map(formatTicket);
        const archivedTickets = tickets.filter(ticket => ticket.event && isEventExpired(ticket.event)).map(formatTicket);
        
        res.render('profile', { 
            user, 
            cards, 
            tickets: formattedTickets,  // ЭТО ДЛЯ СТАРОГО КОДА В PROFILE.EJS
            activeTickets: activeTickets,
            archivedTickets: archivedTickets,
            currentPage: 'profile' 
        });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};

exports.editProfile = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { full_name } = req.body;
    if (!validateFullName(full_name)) {
        return res.json({ success: false, message: 'ФИО должно содержать фамилию, имя и отчество (минимум 3 слова, каждое слово минимум 2 буквы)' });
    }
    try {
        await User.update({ full_name: full_name.trim() }, { where: { user_code: req.session.user.user_code } });
        req.session.user.full_name = full_name.trim();
        await logAction(req.session.user.user_code, `Смена ФИО`);
        await addNotification(req.session.user.user_code, 'Изменение данных', `ФИО изменено на ${full_name}`);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: 'Ошибка при обновлении' });
    }
};

exports.requestEmailChange = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    const { new_email } = req.body;
    if (!new_email) {
        return res.status(400).json({ success: false, message: 'Введите новый email' });
    }
    if (new_email === req.session.user.email) {
        return res.status(400).json({ success: false, message: 'Новый email совпадает с текущим' });
    }
    try {
        const existingUser = await User.findOne({
            where: { email: new_email, user_code: { [Op.ne]: req.session.user.user_code } }
        });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Этот email уже используется другим пользователем' });
        }
        await VerificationCode.destroy({ where: { email: new_email, used: false } });
        const code = generateCode();
        const expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + 10);
        await VerificationCode.create({ email: new_email, code, expires_at, used: false });
        const oldEmail = req.session.user.email;
        const emailResult = await sendEmailChangeCode(new_email, code, oldEmail);
        if (!emailResult.success) {
            return res.status(500).json({ success: false, message: 'Не удалось отправить код на новый email' });
        }
        req.session.pendingEmail = new_email;
        res.json({ success: true, message: 'Код подтверждения отправлен на новый email' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при отправке кода' });
    }
};

exports.confirmEmailChange = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    const { code } = req.body;
    const newEmail = req.session.pendingEmail;
    if (!newEmail) {
        return res.status(400).json({ success: false, message: 'Сначала запросите смену email' });
    }
    try {
        const verificationCode = await VerificationCode.findOne({
            where: { email: newEmail, code, used: false, expires_at: { [Op.gt]: new Date() } }
        });
        if (!verificationCode) {
            return res.status(400).json({ success: false, message: 'Неверный или просроченный код' });
        }
        await verificationCode.update({ used: true });
        const oldEmail = req.session.user.email;
        await User.update({ email: newEmail }, { where: { user_code: req.session.user.user_code } });
        await VerificationCode.update({ email: newEmail }, { where: { email: oldEmail, used: false } });
        req.session.user.email = newEmail;
        delete req.session.pendingEmail;
        await logAction(req.session.user.user_code, `Смена email`);
        await addNotification(req.session.user.user_code, 'Смена email', `Email изменен на ${newEmail}`);
        res.json({ success: true, message: 'Email успешно изменен!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при подтверждении' });
    }
};

exports.changePassword = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    const { current_password, new_password, confirm_password } = req.body;
    if (new_password !== confirm_password) {
        return res.status(400).json({ success: false, message: 'Пароли не совпадают' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'Пароль должен содержать минимум 6 символов' });
    }
    try {
        const user = await User.findByPk(req.session.user.user_code);
        const isValid = await bcrypt.compare(current_password, user.password);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Неверный текущий пароль' });
        }
        const isSamePassword = await bcrypt.compare(new_password, user.password);
        if (isSamePassword) {
            return res.status(400).json({ success: false, message: 'Новый пароль не должен совпадать со старым' });
        }
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await User.update({ password: hashedPassword }, { where: { user_code: req.session.user.user_code } });
        await logAction(req.session.user.user_code, `Смена пароля`);
        await addNotification(req.session.user.user_code, 'Смена пароля', `Пароль изменен`);
        res.json({ success: true, message: 'Пароль успешно изменен!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при смене пароля' });
    }
};

exports.addCard = async (req, res) => {
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
        await Card.create({
            card_number: card_number.replace(/\s/g, ''),
            expiry_date,
            cvv: hashedCvv,
            user_code: req.session.user.user_code
        });
        await logAction(req.session.user.user_code, `Новая карта ${card_number.slice(-4)} (${expiry_date})`);
        await addNotification(req.session.user.user_code, 'Добавление карты', `Добавлена карта **** ${card_number.slice(-4)}`);
        res.json({ success: true, message: 'Карта добавлена' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при добавлении карты' });
    }
};

exports.getCards = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    try {
        const cards = await Card.findAll({
            where: { user_code: req.session.user.user_code },
            attributes: ['card_code', 'card_number', 'expiry_date']
        });
        res.json({ success: true, cards: cards });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при загрузке карт' });
    }
};

exports.updateCard = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    const { cardCode } = req.params;
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
        const card = await Card.findOne({
            where: { card_code: cardCode, user_code: req.session.user.user_code }
        });
        if (!card) {
            return res.status(404).json({ success: false, message: 'Карта не найдена' });
        }
        const hashedCvv = await bcrypt.hash(cvv, 10);
        await card.update({
            card_number: card_number.replace(/\s/g, ''),
            expiry_date,
            cvv: hashedCvv
        });
        await logAction(req.session.user.user_code, `Обновление карты`);
        await addNotification(req.session.user.user_code, 'Обновление карты', `Обновлена карта **** ${card_number.slice(-4)}`);
        res.json({ success: true, message: 'Карта обновлена' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при обновлении карты' });
    }
};

exports.deleteCard = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Не авторизован' });
    const { cardCode } = req.params;
    try {
        const card = await Card.findOne({
            where: { card_code: cardCode, user_code: req.session.user.user_code }
        });
        if (!card) {
            return res.status(404).json({ success: false, message: 'Карта не найдена' });
        }
        const cardNumber = card.card_number;
        await card.destroy();
        await logAction(req.session.user.user_code, `Удаление карты`);
        await addNotification(req.session.user.user_code, 'Удаление карты', `Удалена карта **** ${cardNumber.slice(-4)}`);
        res.json({ success: true, message: 'Карта удалена' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при удалении карты' });
    }
};

exports.returnTicket = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, error: 'Не авторизован' });
    const { ticketCode } = req.params;
    try {
        const ticket = await Ticket.findOne({
            where: { ticket_code: ticketCode, user_code: req.session.user.user_code },
            include: [{ model: Event, as: 'event' }]
        });
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Билет не найден' });
        }
        const eventDate = new Date(ticket.event.date);
        const now = new Date();
        const hoursDiff = (eventDate - now) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
            return res.status(400).json({ success: false, error: 'Возврат билета возможен не менее чем за 24 часа до начала мероприятия' });
        }
        await Event.update({ available_seats: ticket.event.available_seats + ticket.quantity }, { where: { event_code: ticket.event_code } });
        await ticket.destroy();
        await logAction(req.session.user.user_code, `Возврат билета ${ticket.quantity}шт`);
        await addNotification(req.session.user.user_code, 'Возврат билета', `Возврат билета на мероприятие "${ticket.event.title_short}"`);
        res.json({ success: true, message: 'Билет возвращен' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Ошибка при возврате билета' });
    }
};