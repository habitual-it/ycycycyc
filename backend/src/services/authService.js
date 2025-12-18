const { randomUUID } = require('crypto');
const config = require('../config');

const tokens = new Map(); // token -> { user, exp }

function issueToken(username) {
  const token = randomUUID();
  const exp = Date.now() + config.auth.tokenTtlMs;
  tokens.set(token, { username, exp });
  return token;
}

function verifyToken(token) {
  if (!token) return null;
  const session = tokens.get(token);
  if (!session) return null;
  if (Date.now() > session.exp) {
    tokens.delete(token);
    return null;
  }
  return session;
}

function login(username, password) {
  if (
    username === config.auth.adminUser &&
    password === config.auth.adminPassword
  ) {
    const token = issueToken(username);
    return { token, user: { username } };
  }
  return null;
}

module.exports = {
  login,
  verifyToken
};
