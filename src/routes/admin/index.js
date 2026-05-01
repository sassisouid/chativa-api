'use strict';
const router = require('express').Router();

router.use('/auth',                    require('./auth'));
router.use('/emails',                  require('./emails'));
router.use('/emails/:id/attachments',  require('./attachments'));

module.exports = router;
