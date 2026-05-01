'use strict';
const express = require('express');
// Applied ONLY to the webhook route — captures raw Buffer before JSON parsing
// type: '*/*' ensures the raw body is captured regardless of Content-Type header
module.exports = express.raw({ type: '*/*', limit: '10mb' });
