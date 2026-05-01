'use strict';
const router = require('express').Router();
const { requireAdmin } = require('../../middleware/auth');
const ctrl = require('../../controllers/admin/emailsController');

// All routes require admin auth
router.use(requireAdmin);

router.get('/',           ctrl.listEmails);
router.get('/stats',      ctrl.getStats);
router.post('/compose',   ctrl.composeEmail);
router.get('/:id',        ctrl.getEmail);
router.patch('/:id',      ctrl.patchEmail);
router.delete('/:id',     ctrl.deleteEmail);
router.post('/:id/reply', ctrl.replyEmail);

module.exports = router;
