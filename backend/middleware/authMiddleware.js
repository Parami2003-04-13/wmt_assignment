const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized — no bearer token' });
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const payload = jwt.verify(token, JWT_SECRET);
    const id = payload.id != null ? String(payload.id) : null;
    if (!id) {
      return res.status(401).json({ message: 'Not authorized — invalid token' });
    }
    req.user = { id, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: 'Not authorized — token rejected' });
  }
}

module.exports = { protect };
