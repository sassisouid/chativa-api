'use strict';
const path   = require('path');
const fs     = require('fs');
const router = require('express').Router({ mergeParams: true });
const { requireAdmin } = require('../../middleware/auth');
const db = require('../../config/db');
const { NotFoundError } = require('../../utils/errors');

router.get('/:attachmentId', requireAdmin, async (req, res, next) => {
  try {
    const att = await db.get(
      'SELECT * FROM attachments WHERE id = ? AND email_id = ?',
      [req.params.attachmentId, req.params.id]
    );

    if (!att) throw new NotFoundError('Attachment');

    const uploadsDir = path.resolve(__dirname, '../../../../uploads');
    const fullPath   = path.resolve(uploadsDir, att.storage_path.replace(/^uploads\//, ''));

    // Path traversal guard
    if (!fullPath.startsWith(uploadsDir + path.sep)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(fullPath)) throw new NotFoundError('Attachment file');

    res.setHeader('Content-Type', att.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${att.filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) { next(err); }
});

module.exports = router;
