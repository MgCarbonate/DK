const bcrypt = require('bcrypt');
const { sequelize, User } = require('../models/index');

async function createTestUser() {
    try {
        await sequelize.sync({ alter: true });
        
        // Проверяем, есть ли уже администратор
        const existingAdmin = await User.findOne({ where: { email: 'admin@domkultury.ru' } });
        
        if (existingAdmin) {
            console.log('Тестовый пользователь уже существует:');
            console.log(`  Email: admin@domkultury.ru`);
            console.log(`  Пароль: admin123`);
            process.exit(0);
        }
        
        const adminPassword = await bcrypt.hash('admin123', 10);
        
        // Создаем администратора (для тестирования админ-панели)
        const admin = await User.create({
            full_name: 'Тестовый Администратор',
            email: 'admin@domkultury.ru',
            password: adminPassword,
            is_verified: true,
            is_admin: true
        });
        
        console.log('========================================');
        console.log('Тестовый пользователь создан!');
        console.log('========================================');
        console.log('\n📧 Email: admin@domkultury.ru');
        console.log('🔑 Пароль: admin123');
        console.log('👤 ФИО: Тестовый Администратор');
        console.log('👑 Роль: Администратор');
        console.log('\n⚠️  Внимание: Этот пользователь уже подтвержден и имеет права администратора');
        
        process.exit(0);
        
    } catch (error) {
        console.error('Ошибка при создании тестового пользователя:', error);
        process.exit(1);
    }
}

createTestUser();