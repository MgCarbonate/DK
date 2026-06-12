const express = require('express');
const router = express.Router();
const sotrudController = require('../controllers/sotrudController');

router.get('/sotrud', sotrudController.getSotrudPage);
router.post('/api/sotrud/submit', sotrudController.submitSotrudForm);
router.get('/admin/api/sotrud/applications', sotrudController.getApplications);
router.put('/admin/api/sotrud/applications/:application_code', sotrudController.updateApplicationStatus);
router.put('/admin/api/sotrud/applications/archive/:application_code', sotrudController.archiveApplication);
router.put('/admin/api/sotrud/applications/restore/:application_code', sotrudController.restoreApplication);

module.exports = router;