const { Event } = require('../models/index');
const { Op } = require('sequelize');

// Функция теперь НЕ УДАЛЯЕТ, а только логирует прошедшие мероприятия
// Мы отключаем авто-удаление, так как теперь мероприятия хранятся в БД постоянно
async function cleanupExpiredEvents() {
    try {
        const now = new Date();
        
        // Находим все мероприятия
        const allEvents = await Event.findAll();
        
        const expiredEvents = [];
        
        for (const event of allEvents) {
            // Собираем дату и время мероприятия
            const eventDateTime = new Date(event.date);
            const [hours, minutes] = event.time.split(':');
            eventDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            // Добавляем 7 дней
            const expireTime = new Date(eventDateTime.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            if (now > expireTime) {
                expiredEvents.push(`${event.title_short} (${event.event_code})`);
            }
        }
        
        if (expiredEvents.length > 0) {
            console.log(`📅 Найдено ${expiredEvents.length} мероприятий, которым больше 7 дней (они в архиве):`);
            expiredEvents.forEach(name => console.log(`   - ${name}`));
            console.log('ℹ️ Мероприятия не удаляются, они остаются в архиве для статистики');
        }
    } catch (error) {
        console.error('❌ Ошибка при проверке мероприятий:', error);
    }
}

// Запускаем при старте и каждые 6 часов (только для логирования)
function startCleanupScheduler() {
    cleanupExpiredEvents();
    setInterval(cleanupExpiredEvents, 6 * 60 * 60 * 1000);
}

module.exports = { cleanupExpiredEvents, startCleanupScheduler };