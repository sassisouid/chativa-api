'use strict';
const router  = require('express').Router();
const rawBody = require('../middleware/rawBody');
const { handleInbound } = require('../controllers/webhookController');

// rawBody middleware MUST come before the controller so req.body is a Buffer
router.post('/brevo/inbound', rawBody, handleInbound);

module.exports = router;
