'use strict';
const router = require('express').Router();
const { contactFormLimiter } = require('../middleware/rateLimiter');
const { handleContact } = require('../controllers/contactController');

router.post('/', contactFormLimiter, handleContact);

module.exports = router;
