const { Staff, AboutSettings, ActionLog } = require('../models/index');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Настройка загрузки фото для сотрудников
const storageStaff = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/staff');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'staff-' + uniqueSuffix + ext);
    }
});

// Настройка загрузки баннера
const storageBanner = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/about');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'banner-' + uniqueSuffix + ext);
    }
});

const uploadStaff = multer({ storage: storageStaff, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadBanner = multer({ storage: storageBanner, limits: { fileSize: 5 * 1024 * 1024 } });

async function logAction(userCode, action) {
    try {
        await ActionLog.create({ user_code: userCode, action });
    } catch (error) {
        console.error('Ошибка логирования:', error);
    }
}

// Страница управления "О нас"
exports.getAboutAdmin = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.redirect('/');
    }
    
    try {
        const bannerSetting = await AboutSettings.findOne({ where: { setting_key: 'banner_image' } });
        const bannerImage = bannerSetting ? bannerSetting.setting_value : '/img/about-banner.png';
        
        const bannerTextSetting = await AboutSettings.findOne({ where: { setting_key: 'banner_text' } });
        const bannerText = bannerTextSetting ? bannerTextSetting.setting_value : 'проект, который объединяет людей через события, атмосферу и живые эмоции';
        
        const staff = await Staff.findAll({ order: [['order_index', 'ASC'], ['name', 'ASC']] });
        
        res.render('admin-about', {
            user: req.session.user,
            currentPage: 'admin',
            adminPage: 'about',
            bannerImage: bannerImage,
            bannerText: bannerText,
            staff: staff
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/statistics');
    }
};

// Загрузка баннера
exports.uploadBanner = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Файл не загружен' });
        }
        
        const imagePath = '/uploads/about/' + req.file.filename;
        
        await AboutSettings.upsert({
            setting_key: 'banner_image',
            setting_value: imagePath,
            updated_at: new Date()
        });
        
        await logAction(req.session.user.user_code, `Обновление баннера страницы "О нас"`);
        
        res.json({ success: true, imagePath: imagePath });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки' });
    }
};

// Обновление текста баннера
exports.updateBannerText = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    
    const { text } = req.body;
    
    try {
        await AboutSettings.upsert({
            setting_key: 'banner_text',
            setting_value: text,
            updated_at: new Date()
        });
        
        await logAction(req.session.user.user_code, `Обновление текста баннера страницы "О нас"`);
        
        res.json({ success: true, message: 'Текст обновлен' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка обновления' });
    }
};

// Получение всех сотрудников
exports.getStaff = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    
    try {
        const staff = await Staff.findAll({ order: [['order_index', 'ASC'], ['name', 'ASC']] });
        res.json({ success: true, staff });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

// Обновление сотрудника
exports.updateStaff = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    
    const { staff_code } = req.params;
    const { name, position, photo } = req.body;
    
    try {
        const staff = await Staff.findByPk(staff_code);
        if (!staff) {
            return res.status(404).json({ success: false, message: 'Сотрудник не найден' });
        }
        
        await staff.update({
            name: name.trim(),
            position: position.trim(),
            photo: photo || staff.photo
        });
        
        await logAction(req.session.user.user_code, `Обновление сотрудника: ${name}`);
        
        res.json({ success: true, message: 'Сотрудник обновлен', staff });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка обновления' });
    }
};

// Загрузка фото сотрудника
exports.uploadStaffPhoto = async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ success: false });
    }
    
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Файл не загружен' });
        }
        
        const imagePath = '/uploads/staff/' + req.file.filename;
        res.json({ success: true, imagePath: imagePath });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки' });
    }
};

// Получение настроек для публичной страницы
exports.getAboutSettings = async (req, res) => {
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

exports.uploadStaffPhotoMiddleware = uploadStaff.single('photo');
exports.uploadBannerMiddleware = uploadBanner.single('banner');