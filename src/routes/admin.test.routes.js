const express = require('express');

const requireAdminAuth = require('../middleware/requireAdminAuth');

const router = express.Router();

router.get('/admin/test', requireAdminAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Admin access granted',
    admin: req.session.admin
  });
});

module.exports = router;
