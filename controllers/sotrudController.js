const { SotrudApplication, ActionLog, User, Notification } = require('../models/index');

exports.getSotrudPage = async (req, res) => {
    try {
        res.render('sotrud', {
            user: req.session.user || null,
            currentPage: 'sotrud'
        });
    } catch (error) {
        console.error('Ошибка загрузки страницы сотрудничества:', error);
        res.render('sotrud', {
            user: req.session.user || null,
            currentPage: 'sotrud'
        });
    }
};

exports.submitSotrudForm = async (req, res) => {
    // Проверка - админ не может отправлять заявки
    if (req.session.user && req.session.user.is_admin) {
        return res.status(403).json({ success: false, message: 'Администратор не может отправлять заявки на сотрудничество' });
    }

    const { fio, email, space, event_type, duration, ticket_price, description } = req.body;

    // Проверка обязательных полей
    if (!fio || !fio.trim()) {
        return res.status(400).json({ success: false, message: 'Заполните все обязательные поля' });
    }
    if (!email || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Заполните все обязательные поля' });
    }
    if (!space) {
        return res.status(400).json({ success: false, message: 'Заполните все обязательные поля' });
    }

    // Валидация ФИО: не менее 3 слов, каждое не менее 2 символов
    const fioParts = fio.trim().split(/\s+/);
    if (fioParts.length < 3) {
        return res.status(400).json({ success: false, message: 'ФИО должно содержать минимум 3 слова, каждое не менее 2 символов' });
    }
    for (const part of fioParts) {
        if (part.length < 2) {
            return res.status(400).json({ success: false, message: 'ФИО должно содержать минимум 3 слова, каждое не менее 2 символов' });
        }
    }

    // Валидация стоимости - только цифры
    if (ticket_price && !/^\d+$/.test(ticket_price)) {
        return res.status(400).json({ success: false, message: 'Стоимость должна содержать только цифры' });
    }

    try {
        const application = await SotrudApplication.create({
            fio: fio.trim(),
            email: email.trim(),
            space,
            event_type: event_type || null,
            duration: duration || null,
            ticket_price: ticket_price || null,
            description: description || null,
            user_code: req.session.user?.user_code || null,
            status: 'pending'
        });

        // Логирование
        await ActionLog.create({
            user_code: req.session.user?.user_code || null,
            action: `Заявка на сотрудничество №${application.application_code}`
        });

        // Отправляем уведомление пользователю, если он авторизован
        if (req.session.user) {
            const { Notification } = require('../models/index');
            await Notification.create({
                user_code: req.session.user.user_code,
                title: 'Заявка отправлена 📋',
                description: 'Ваша заявка на сотрудничество принята! Мы рассмотрим её в течение 3 рабочих дней и свяжемся с вами.',
                is_read: false
            });
        }

        res.json({ success: true, message: 'Заявка отправлена! Мы свяжемся с вами в ближайшее время.' });
    } catch (error) {
        console.error('Ошибка при сохранении заявки:', error);
        res.status(500).json({ success: false, message: 'Ошибка при отправке заявки' });
    }
};

exports.getApplications = async (req, res) => {
    try {
        const applications = await SotrudApplication.findAll({
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, applications });
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки' });
    }
};

// Замените существующую функцию updateApplicationStatus на эту:

exports.updateApplicationStatus = async (req, res) => {
    const { application_code } = req.params;
    const { status } = req.body;

    try {
        const application = await SotrudApplication.findByPk(application_code);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Заявка не найдена' });
        }

        const applicationFio = application.fio;
        const applicationEmail = application.email;
        const applicationEventType = application.event_type;

        // Логируем действие
        let actionMessage;
        
        if (status === 'approved') {
            actionMessage = `Заявка №${application_code} одобрена`;
            
            // Обновляем статус (НЕ УДАЛЯЕМ)
            application.status = status;
            await application.save();
            
            // Отправляем уведомление пользователю
            const user = await User.findOne({ where: { email: applicationEmail } });
            if (user) {
                await Notification.create({
                    user_code: user.user_code,
                    title: 'Заявка одобрена! ✅',
                    description: `Ваша заявка на мероприятие "${applicationEventType || 'Сотрудничество'}" одобрена! Мы свяжемся с вами для обсуждения деталей.`,
                    is_read: false
                });
            }
            
            await ActionLog.create({
                user_code: req.session.user.user_code,
                action: actionMessage
            });
            
            res.json({ success: true, message: 'Заявка одобрена' });
            
        } else if (status === 'rejected') {
            actionMessage = `Заявка №${application_code} отклонена и удалена`;
            
            // Отправляем уведомление ПЕРЕД удалением
            const user = await User.findOne({ where: { email: applicationEmail } });
            if (user) {
                await Notification.create({
                    user_code: user.user_code,
                    title: 'Заявка отклонена ❌',
                    description: `К сожалению, ваша заявка на мероприятие "${applicationEventType || 'Сотрудничество'}" отклонена. Вы можете отправить новую заявку.`,
                    is_read: false
                });
            }
            
            // Логируем действие ДО удаления
            await ActionLog.create({
                user_code: req.session.user.user_code,
                action: actionMessage
            });
            
            // УДАЛЯЕМ заявку
            await application.destroy();
            
            res.json({ success: true, message: 'Заявка отклонена и удалена' });
        } else {
            res.status(400).json({ success: false, message: 'Неверный статус' });
        }
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка обновления' });
    }
};

// Обновите функцию archiveApplication
exports.archiveApplication = async (req, res) => {
    const { application_code } = req.params;
    
    try {
        const application = await SotrudApplication.findByPk(application_code);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Заявка не найдена' });
        }
        
        // Только если заявка не отклонена (не удалена)
        if (application.status === 'rejected') {
            return res.status(400).json({ success: false, message: 'Отклоненную заявку нельзя архивировать' });
        }
        
        application.status = 'archived';
        await application.save();
        
        await ActionLog.create({
            user_code: req.session.user.user_code,
            action: `Заявка №${application_code} перемещена в архив`
        });
        
        res.json({ success: true, message: 'Заявка перемещена в архив' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при архивации' });
    }
};

exports.restoreApplication = async (req, res) => {
    const { application_code } = req.params;
    
    try {
        const application = await SotrudApplication.findByPk(application_code);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Заявка не найдена' });
        }
        
        application.status = 'pending';
        await application.save();
        
        await ActionLog.create({
            user_code: req.session.user.user_code,
            action: `Заявка №${application_code} восстановлена из архива`
        });
        
        res.json({ success: true, message: 'Заявка восстановлена из архива' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при восстановлении' });
    }
};