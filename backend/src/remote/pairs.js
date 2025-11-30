const { randomInt } = require('crypto');
const config = require('../config');

const pairs = new Map(); // code -> { deviceId, createdAt, expiresAt }

function generateCode() {
  let code = '';
  do {
    code = String(randomInt(100000, 999999));
  } while (pairs.has(code));
  return code;
}

function createPair(deviceId = null) {
  const code = generateCode();
  const now = Date.now();
  const expiresAt = now + config.signaling.pairTtlMs;
  pairs.set(code, { deviceId, createdAt: now, expiresAt });
  return { code, deviceId, expiresAt };
}

function verifyPair(code) {
  const entry = pairs.get(code);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pairs.delete(code);
    return null;
  }
  return entry;
}

function touchPair(code, deviceId) {
  const entry = verifyPair(code);
  if (!entry) return null;
  if (deviceId && !entry.deviceId) {
    entry.deviceId = deviceId;
  }
  return entry;
}

function removePair(code) {
  pairs.delete(code);
}

module.exports = {
  createPair,
  verifyPair,
  touchPair,
  removePair
};
