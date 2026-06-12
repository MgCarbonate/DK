const bcrypt = require('bcrypt');
const { User, VerificationCode, ActionLog } = require('../models/index');
const { sendVerificationCode, sendResetPasswordCode } = require('../services/emailService');
const { Op } = require('sequelize');
const { addNotification } = require('./notificationController');
const activeUsers = require('../services/activeUsersMemory');

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

async function logAction(userCode, action) {
    try {
        await ActionLog.create({ user_code: userCode, action });
    } catch (error) {
        console.error('Ошибка логирования:', error);
    }
}

exports.getLogin = (req, res) => {
    if (req.session.user) {
        if (req.session.user.is_admin) return res.redirect('/admin/statistics');
        return res.redirect('/profile');
    }
    const reset = req.query.reset || null;
    res.render('login', { error: null, reset: reset, currentPage: 'login' });
};

exports.getRegister = (req, res) => {
    if (req.session.user) {
        if (req.session.user.is_admin) return res.redirect('/admin/statistics');
        return res.redirect('/profile');
    }
    res.render('register', { error: null, currentPage: 'register' });
};

exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.json({ success: false, error: 'Неверный пароль' });
        }
        if (!user.is_verified) {
            return res.json({ success: false, error: 'Подтвердите email. Проверьте почту' });
        }
        req.session.user = {
            user_code: user.user_code,
            full_name: user.full_name,
            email: user.email,
            is_admin: user.is_admin || false
        };
        await logAction(user.user_code, `Вход`);
        await addNotification(user.user_code, 'Вход в аккаунт', '');
        const redirectUrl = user.is_admin ? '/admin/statistics' : '/profile';
        res.json({ success: true, redirect: redirectUrl });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error: 'Ошибка при входе' });
    }
};

exports.postRegister = async (req, res) => {
    const { full_name, email, password, confirm_password } = req.body;
    if (!validateFullName(full_name)) {
        return res.status(400).json({ success: false, message: 'ФИО должно содержать фамилию, имя и отчество (минимум 3 слова, каждое слово минимум 2 буквы)' });
    }
    if (password !== confirm_password) {
        return res.status(400).json({ success: false, message: 'Пароли не совпадают' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Пароль должен содержать минимум 6 символов' });
    }
    try {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Пользователь с таким email уже существует' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            full_name: full_name.trim(),
            email,
            password: hashedPassword,
            is_verified: false,
            is_admin: false
        });
        const code = generateCode();
        const expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + 10);
        await VerificationCode.create({ email, code, expires_at, used: false });
        const emailResult = await sendVerificationCode(email, code);
        if (!emailResult.success) {
            await user.destroy();
            return res.status(500).json({ success: false, message: 'Не удалось отправить код подтверждения. Попробуйте позже.' });
        }
        await logAction(user.user_code, `Регистрация`);
        res.json({ success: true, message: 'Код подтверждения отправлен на почту', email });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при регистрации' });
    }
};

exports.verifyCode = async (req, res) => {
    const { email, code } = req.body;
    try {
        const verificationCode = await VerificationCode.findOne({
            where: { email, code, used: false, expires_at: { [Op.gt]: new Date() } }
        });
        if (!verificationCode) {
            return res.status(400).json({ success: false, message: 'Неверный или просроченный код' });
        }
        await verificationCode.update({ used: true });
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }
        await user.update({ is_verified: true });
        req.session.user = {
            user_code: user.user_code,
            full_name: user.full_name,
            email: user.email,
            is_admin: user.is_admin || false
        };
        await logAction(user.user_code, `Подтверждение email`);
        const redirectUrl = user.is_admin ? '/admin/statistics' : '/profile';
        res.json({ success: true, message: 'Email подтвержден!', redirect: redirectUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при подтверждении' });
    }
};

exports.resendCode = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }
        if (user.is_verified) {
            return res.status(400).json({ success: false, message: 'Email уже подтвержден' });
        }
        await VerificationCode.destroy({ where: { email, used: false } });
        const code = generateCode();
        const expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + 10);
        await VerificationCode.create({ email, code, expires_at, used: false });
        const emailResult = await sendVerificationCode(email, code);
        if (!emailResult.success) {
            return res.status(500).json({ success: false, message: 'Не удалось отправить код' });
        }
        res.json({ success: true, message: 'Новый код отправлен на почту' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при отправке кода' });
    }
};

exports.sendResetCode = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Введите email' });
    }
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Пользователь с таким email не найден' });
        }
        await VerificationCode.destroy({ where: { email, used: false } });
        const code = generateCode();
        const expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + 10);
        await VerificationCode.create({ email, code, expires_at, used: false });
        const emailResult = await sendResetPasswordCode(email, code);
        if (!emailResult.success) {
            return res.status(500).json({ success: false, message: 'Не удалось отправить код. Попробуйте позже.' });
        }
        req.session.resetEmail = email;
        res.json({ success: true, message: 'Код восстановления отправлен на почту!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при отправке кода' });
    }
};

exports.verifyResetCode = async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Неверные данные' });
    }
    try {
        const verificationCode = await VerificationCode.findOne({
            where: { email, code, used: false, expires_at: { [Op.gt]: new Date() } }
        });
        if (!verificationCode) {
            return res.status(400).json({ success: false, message: 'Неверный или просроченный код' });
        }
        await verificationCode.update({ used: true });
        res.json({ success: true, message: 'Код подтвержден!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при проверке кода' });
    }
};

exports.resendResetCode = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Введите email' });
    }
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }
        await VerificationCode.destroy({ where: { email, used: false } });
        const code = generateCode();
        const expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + 10);
        await VerificationCode.create({ email, code, expires_at, used: false });
        const emailResult = await sendResetPasswordCode(email, code);
        if (!emailResult.success) {
            return res.status(500).json({ success: false, message: 'Не удалось отправить код' });
        }
        res.json({ success: true, message: 'Код отправлен повторно!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при отправке кода' });
    }
};

exports.resetPassword = async (req, res) => {
    const { email, code, new_password } = req.body;
    if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'Пароль должен содержать минимум 6 символов' });
    }
    try {
        const user = await User.findOne({ where: { email } });
        const isSamePassword = await bcrypt.compare(new_password, user.password);
        if (isSamePassword) {
            return res.status(400).json({ success: false, message: 'Новый пароль совпадает со старым. Придумайте другой пароль.' });
        }
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await User.update({ password: hashedPassword }, { where: { email } });
        await logAction(user.user_code, `Сброс пароля`);
        delete req.session.resetEmail;
        res.json({ success: true, message: 'Пароль успешно изменен! Теперь вы можете войти.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при сбросе пароля' });
    }
};

exports.logout = async (req, res) => {
    if (req.session.user) {
        await addNotification(req.session.user.user_code, 'Выход из аккаунта', '');
        await logAction(req.session.user.user_code, `Выход`);
        
        if (req.sessionID) {
            activeUsers.removeUserSession(req.sessionID);
        }
    }
    req.session.destroy();
    res.redirect('/');
};

// Функция создания админа
function createAdminIfNotExists() {
    return (async () => {
        const adminEmail = 'admin2006@gmail.com';
        const adminPassword = 'Admin2006!';
        try {
            const existingAdmin = await User.findOne({ where: { email: adminEmail } });
            if (!existingAdmin) {
                const hashedPassword = await bcrypt.hash(adminPassword, 10);
                await User.create({
                    full_name: 'Администратор',
                    email: adminEmail,
                    password: hashedPassword,
                    is_verified: true,
                    is_admin: true
                });
                console.log('✅ Администратор создан: admin2006@gmail.com / Admin2006!');
            }
        } catch (error) {
            console.error('Ошибка создания администратора:', error);
        }
    })();
}

exports.createAdminIfNotExists = createAdminIfNotExists;