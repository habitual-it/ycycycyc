const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const authMiddleware = require('./middleware/auth');
const authRouter = require('./routes/auth');
const devicesRouter = require('./routes/devices');
const scriptsRouter = require('./routes/scripts');
const tasksRouter = require('./routes/tasks');
const remoteRouter = require('./routes/remote');
const taskRunner = require('./services/taskRunner');
const { startSignalingServer } = require('./remote/signaling');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use(authMiddleware);

app.use('/api/devices', devicesRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/remote', remoteRouter);

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Basic error handler for async routes
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ message: err.message || 'Internal server error' });
});

server.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
  startSignalingServer(server);
  taskRunner.start();
});

module.exports = app;
