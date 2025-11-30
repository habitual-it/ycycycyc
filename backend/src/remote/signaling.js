const WebSocket = require('ws');
const config = require('../config');
const authService = require('../services/authService');
const { verifyPair, touchPair, createPair, removePair } = require('./pairs');

// In-memory connection store
const devices = new Map(); // code -> ws
const controllers = new Map(); // code -> ws

const send = (ws, data) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
};

function attachHandlers(ws, role, code, deviceId) {
  ws.role = role;
  ws.code = code;
  ws.deviceId = deviceId;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }
    const peerMap = role === 'device' ? controllers : devices;
    const peer = peerMap.get(code);
    if (!peer || peer.readyState !== WebSocket.OPEN) return;

    if (['offer', 'answer', 'candidate', 'bye'].includes(msg.type)) {
      send(peer, { ...msg, from: role });
    }
  });

  ws.on('close', () => {
    const peerMap = role === 'device' ? controllers : devices;
    const selfMap = role === 'device' ? devices : controllers;
    const peer = peerMap.get(code);
    if (peer && peer.readyState === WebSocket.OPEN) {
      send(peer, { type: 'bye', reason: `${role} disconnected` });
    }
    selfMap.delete(code);
  });
}

function handleHello(ws, msg) {
  const { role, code, deviceId, token } = msg;
  if (!role || !code) {
    return send(ws, { type: 'error', message: 'role and code are required' });
  }

  if (role === 'controller') {
    const session = authService.verifyToken(token);
    if (!session) {
      return send(ws, { type: 'error', message: 'Unauthorized' });
    }
  }

  // Validate pair code
  const pair = touchPair(code, deviceId || null) || createPair(deviceId || null);

  if (role === 'device') {
    devices.set(code, ws);
    attachHandlers(ws, role, code, deviceId);
    send(ws, { type: 'ready', code, deviceId: deviceId || pair.deviceId });
    const ctrl = controllers.get(code);
    if (ctrl) {
      send(ctrl, { type: 'device_ready', code, deviceId: deviceId || pair.deviceId });
    }
    return;
  }

  if (role === 'controller') {
    controllers.set(code, ws);
    attachHandlers(ws, role, code, deviceId);
    send(ws, { type: 'ready', code, deviceId: deviceId || pair.deviceId });
    const dev = devices.get(code);
    if (dev) {
      send(dev, { type: 'controller_ready', code });
      send(ws, { type: 'device_ready', code, deviceId: deviceId || pair.deviceId });
    } else {
      send(ws, { type: 'waiting', message: 'Waiting for device to connect' });
    }
  }
}

function startSignalingServer(server) {
  const wss = new WebSocket.Server({ server, path: config.signaling.wsPath });
  console.log(`Signaling WS listening on path ${config.signaling.wsPath}`);

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        send(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }
      if (msg.type === 'hello') {
        handleHello(ws, msg);
      }
    });

    ws.on('error', (err) => {
      console.error('WS error', err);
    });
  });
}

module.exports = {
  startSignalingServer,
  removePair
};
