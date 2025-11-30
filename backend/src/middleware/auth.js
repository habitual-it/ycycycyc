const authService = require('../services/authService');

const openPaths = ['/api/health', '/api/auth/login'];

function authMiddleware(req, res, next) {
  if (!req.path.startsWith('/api')) return next();

  const path = req.originalUrl.split('?')[0];
  if (openPaths.includes(path)) return next();

  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');

  const session = authService.verifyToken(token);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  req.user = session;
  return next();
}

module.exports = authMiddleware;
