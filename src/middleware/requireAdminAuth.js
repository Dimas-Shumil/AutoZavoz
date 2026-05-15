function requireAdminAuth(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({
      success: false,
      message: 'Не авторизован'
    });
  }

  next();
}

module.exports = requireAdminAuth;
