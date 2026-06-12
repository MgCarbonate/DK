const { Staff, AboutSettings } = require('../models/index');

// Получение всех сотрудников (публичный)
exports.getStaff = async (req, res) => {
    try {
        const staff = await Staff.findAll({ 
            order: [['order_index', 'ASC'], ['name', 'ASC']] 
        });
        res.json({ success: true, staff });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки' });
    }
};

// Получение настроек страницы (публичный)
exports.getSettings = async (req, res) => {
    try {
        const bannerSetting = await AboutSettings.findOne({ where: { setting_key: 'banner_image' } });
        const bannerTextSetting = await AboutSettings.findOne({ where: { setting_key: 'banner_text' } });
        
        res.json({
            success: true,
            bannerImage: bannerSetting ? bannerSetting.setting_value : '/img/about-banner.png',
            bannerText: bannerTextSetting ? bannerTextSetting.setting_value : 'проект, который объединяет людей через события, атмосферу и живые эмоции'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};