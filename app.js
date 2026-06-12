const express = require('express');
const session = require('express-session');
const path = require('path');
const { sequelize } = require('./models/index');
const bcrypt = require('bcrypt');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const eventRoutes = require('./routes/eventRoutes');
const cartRoutes = require('./routes/cartRoutes');
const adminRoutes = require('./routes/adminRoutes');
const sotrudRoutes = require('./routes/sotrudRoutes');
const aboutRoutes = require('./routes/aboutRoutes');
const aboutAdminRoutes = require('./routes/aboutAdminRoutes'); // ДОБАВИТЬ

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'dom-kultury-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));

const trackActivity = require('./middlewares/trackActivityMemory');
app.use(trackActivity);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use('/', authRoutes);
app.use('/', profileRoutes);
app.use('/', eventRoutes);
app.use('/', cartRoutes);
app.use('/', adminRoutes);
app.use('/', sotrudRoutes);
app.use('/', aboutRoutes);
app.use('/', aboutAdminRoutes); // ДОБАВИТЬ

app.get('/', async (req, res) => {
    const { Event } = require('./models/index');
    try {
        const events = await Event.findAll({
            limit: 6,
            order: [['date', 'ASC']]
        });
        res.render('index', { events, currentPage: 'home' });
    } catch (error) {
        console.error(error);
        res.render('index', { events: [], currentPage: 'home' });
    }
});

// Функция для создания администратора
async function createAdminIfNotExists() {
    const { User } = require('./models/index');

    try {
        const existingAdmin = await User.findOne({ where: { email: 'admin2006@gmail.com' } });

        if (!existingAdmin) {
            const adminPassword = await bcrypt.hash('Admin2006!', 10);
            await User.create({
                full_name: 'Администратор',
                email: 'admin2006@gmail.com',
                password: adminPassword,
                is_verified: true,
                is_admin: true
            });
            console.log('✅ Администратор создан: admin2006@gmail.com');
        } else {
            console.log('👑 Администратор уже существует');
        }
    } catch (error) {
        console.error('Ошибка при создании администратора:', error.message);
    }
}

// Функция для создания сотрудников
async function createStaffIfNotExists() {
    const { Staff } = require('./models/index');
    
    const staffData = [
        { name: 'Алиса', position: 'Директор', photo: '/img/about-alis.png', order_index: 1 },
        { name: 'Катя', position: 'Иллюстратор', photo: '/img/about-kat.png', order_index: 2 },
        { name: 'Женя', position: 'Дизайнер', photo: '/img/about-evg.png', order_index: 3 },
        { name: 'Николай', position: 'Барменеджер', photo: '/img/about-nik.png', order_index: 4 },
        { name: 'Юля', position: 'Сценарист', photo: '/img/about-jul.png', order_index: 5 },
        { name: 'Маша', position: 'Лектор по искусству', photo: '/img/about-mar.png', order_index: 6 },
        { name: 'Вика', position: 'Фасадный декоратор', photo: '/img/about-vik.png', order_index: 7 }
    ];
    
    try {
        const count = await Staff.count();
        if (count === 0) {
            console.log('📝 Добавление сотрудников...');
            await Staff.bulkCreate(staffData);
            console.log(`✅ Добавлено ${staffData.length} сотрудников`);
        } else {
            console.log(`👥 Сотрудники уже есть (${count} шт.)`);
        }
    } catch (error) {
        console.error('Ошибка при создании сотрудников:', error);
    }
}

// Синхронизация базы данных
sequelize.sync({ force: false }).then(async () => {
    console.log('📦 База данных синхронизирована');
    await createAdminIfNotExists();
    await createStaffIfNotExists();
}).catch(err => {
    console.error('❌ Ошибка синхронизации:', err);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log('🔑 Админ: admin2006@gmail.com / Admin2006!');
});