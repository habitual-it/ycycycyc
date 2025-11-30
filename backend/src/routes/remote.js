const express = require('express');
const { createPair } = require('../remote/pairs');

const router = express.Router();

router.post('/pair', (req, res) => {
  const { deviceId } = req.body || {};
  const pair = createPair(deviceId || null);
  res.json({
    code: pair.code,
    deviceId: pair.deviceId,
    expiresAt: new Date(pair.expiresAt).toISOString()
  });
});

module.exports = router;
