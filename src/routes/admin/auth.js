'use strict';
const router = require('express').Router();
const { loginLimiter } = require('../../middleware/rateLimiter');
const { requireAdmin } = require('../../middleware/auth');
const { login, refresh, logout } = require('../../controllers/admin/authController');

router.post('/login',   loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout',  requireAdmin, logout);

module.exports = router;
