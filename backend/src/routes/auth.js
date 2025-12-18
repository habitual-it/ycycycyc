const express = require('express');
const authService = require('../services/authService');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' });
  }

  const session = authService.login(username, password);
  if (!session) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  return res.json(session);
});

module.exports = router;
