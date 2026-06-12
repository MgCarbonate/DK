// Хранилище активных пользователей в памяти
const activeSessions = new Map();

setInterval(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000; // 5 минут
    let cleanedCount = 0;
    
    for (const [sessionId, data] of activeSessions.entries()) {
        if (data.lastActivity < fiveMinutesAgo) {
            activeSessions.delete(sessionId);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Очищено ${cleanedCount} неактивных сессий`);
    }
}, 60 * 1000); // Проверяем каждую минуту

function updateUserActivity(sessionId, userCode, userData = {}) {
    if (!sessionId || !userCode) return;
    
    activeSessions.set(sessionId, {
        user_code: userCode,
        lastActivity: Date.now(),
        userData: {
            full_name: userData.full_name || userCode,
            email: userData.email || '',
            ...userData
        }
    });
}

function getActiveUsersCount() {
    const uniqueUsers = new Set();
    for (const data of activeSessions.values()) {
        uniqueUsers.add(data.user_code);
    }
    return uniqueUsers.size;
}


function getActiveUsersList() {
    const usersMap = new Map();
    
    for (const data of activeSessions.values()) {
        if (!usersMap.has(data.user_code)) {
            usersMap.set(data.user_code, {
                user_code: data.user_code,
                full_name: data.userData.full_name,
                email: data.userData.email,
                last_activity: new Date(data.lastActivity).toLocaleString('ru-RU'),
                sessions_count: 1
            });
        } else {
            const user = usersMap.get(data.user_code);
            user.sessions_count++;
            // Обновляем время последней активности, если эта сессия новее
            if (data.lastActivity > new Date(user.last_activity).getTime()) {
                user.last_activity = new Date(data.lastActivity).toLocaleString('ru-RU');
            }
        }
    }
    
    return Array.from(usersMap.values());
}

function removeUserSession(sessionId) {
    if (activeSessions.has(sessionId)) {
        activeSessions.delete(sessionId);
        console.log(`👤 Сессия ${sessionId} удалена`);
        return true;
    }
    return false;
}

function getActiveStats() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const fifteenMinutesAgo = now - 15 * 60 * 1000;
    
    let activeLastMinute = 0;
    let activeLast5Minutes = 0;
    let activeLast15Minutes = 0;
    const uniqueUsersLast5Min = new Set();
    
    for (const data of activeSessions.values()) {
        if (data.lastActivity > oneMinuteAgo) activeLastMinute++;
        if (data.lastActivity > fiveMinutesAgo) {
            activeLast5Minutes++;
            uniqueUsersLast5Min.add(data.user_code);
        }
        if (data.lastActivity > fifteenMinutesAgo) activeLast15Minutes++;
    }
    
    return {
        total_sessions: activeSessions.size,
        unique_users: getActiveUsersCount(),
        active_last_minute: activeLastMinute,
        active_last_5_minutes: activeLast5Minutes,
        active_last_15_minutes: activeLast15Minutes,
        unique_users_last_5_min: uniqueUsersLast5Min.size
    };
}

function isUserActive(userCode) {
    for (const data of activeSessions.values()) {
        if (data.user_code === userCode) {
            return true;
        }
    }
    return false;
}

module.exports = {
    updateUserActivity,
    getActiveUsersCount,
    getActiveUsersList,
    removeUserSession,
    getActiveStats,
    isUserActive
};