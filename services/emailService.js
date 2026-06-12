const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.yandex.ru',
    port: process.env.EMAIL_PORT || 465,
    secure: true, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Базовые стили
const styles = `
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 500px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: #80191B;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 20px;
            margin: 0;
            font-weight: 600;
        }
        .content {
            padding: 30px;
            text-align: center;
        }
        .content p {
            color: #333;
            line-height: 1.5;
            margin-bottom: 20px;
        }
        .code {
            background: #f5f5f5;
            padding: 15px;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #80191B;
            font-family: monospace;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            background: #f9f9f9;
            padding: 15px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #eee;
        }
        hr {
            margin: 20px 0;
            border: none;
            border-top: 1px solid #eee;
        }
        .old-email, .new-email {
            background: #f5f5f5;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: monospace;
            margin: 5px 0;
        }
    </style>
`;

// Отправка кода подтверждения регистрации
async function sendVerificationCode(email, code) {
    try {
        const info = await transporter.sendMail({
            from: `"Дом Культур" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Подтверждение регистрации',
            html: `
                <!DOCTYPE html>
                <html>
                <head>${styles}</head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>ДОМ КУЛЬТУР</h1>
                        </div>
                        <div class="content">
                            <p>Для завершения регистрации введите код:</p>
                            <div class="code">${code}</div>
                            <p>Код действителен 10 минут.</p>
                            <hr>
                            <p style="font-size: 12px; color: #999;">Если вы не регистрировались, проигнорируйте это письмо.</p>
                        </div>
                        <div class="footer">
                            Дом Культур
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        return { success: true };
    } catch (error) {
        console.error('Ошибка:', error.message);
        return { success: false, error: error.message };
    }
}

// Отправка кода для смены email
async function sendEmailChangeCode(email, code, oldEmail) {
    try {
        const info = await transporter.sendMail({
            from: `"Дом Культур" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Смена email',
            html: `
                <!DOCTYPE html>
                <html>
                <head>${styles}</head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>ДОМ КУЛЬТУР</h1>
                        </div>
                        <div class="content">
                            <p>Подтвердите смену email:</p>
                            <div class="old-email">Старый: ${oldEmail}</div>
                            <div class="new-email">Новый: ${email}</div>
                            <div class="code">${code}</div>
                            <p>Код действителен 10 минут.</p>
                        </div>
                        <div class="footer">
                            Дом Культур
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        return { success: true };
    } catch (error) {
        console.error('Ошибка:', error.message);
        return { success: false, error: error.message };
    }
}

// Отправка кода для восстановления пароля
async function sendResetPasswordCode(email, code) {
    try {
        const info = await transporter.sendMail({
            from: `"Дом Культур" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Восстановление пароля',
            html: `
                <!DOCTYPE html>
                <html>
                <head>${styles}</head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>ДОМ КУЛЬТУР</h1>
                        </div>
                        <div class="content">
                            <p>Вы запросили восстановление пароля.</p>
                            <div class="code">${code}</div>
                            <p>Код действителен 10 минут.</p>
                            <hr>
                            <p style="font-size: 12px; color: #999;">Если вы не запрашивали восстановление, проигнорируйте это письмо.</p>
                        </div>
                        <div class="footer">
                            Дом Культур
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        return { success: true };
    } catch (error) {
        console.error('Ошибка:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendVerificationCode,
    sendEmailChangeCode,
    sendResetPasswordCode
};