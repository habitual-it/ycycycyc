require('dotenv').config();

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  port: parseNumber(process.env.PORT, 4000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseNumber(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'control_panel',
    connectionLimit: parseNumber(process.env.DB_POOL_SIZE, 10)
  },
  auth: {
    adminUser: process.env.ADMIN_USER || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    tokenTtlMs: parseNumber(process.env.AUTH_TOKEN_TTL_MS, 24 * 60 * 60 * 1000) // 24h
  },
  signaling: {
    wsPath: process.env.SIGNALING_PATH || '/ws',
    pairTtlMs: parseNumber(process.env.SIGNALING_PAIR_TTL_MS, 30 * 60 * 1000), // 30min
    stunServers: (process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    turnServers: process.env.TURN_SERVERS
      ? process.env.TURN_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  },
  simulation: {
    tickMs: parseNumber(process.env.SIMULATION_TICK_MS, 2000),
    onlineRate: parseNumber(process.env.SIMULATION_ONLINE_RATE, 0.85),
    successRate: parseNumber(process.env.SIMULATION_SUCCESS_RATE, 0.8),
    batchLimit: parseNumber(process.env.SIMULATION_BATCH_LIMIT, 50)
  }
};

module.exports = config;
