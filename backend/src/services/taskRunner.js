const db = require('../db');
const config = require('../config');
const taskService = require('./taskService');

let timer = null;

async function markDeviceStatus(deviceId, status) {
  await db.query(
    'UPDATE devices SET status = ?, last_seen = ?, updated_at = ? WHERE id = ?',
    [status, new Date(), new Date(), deviceId]
  );
}

async function processRun(run) {
  const now = new Date();

  if (run.status === taskService.RUN_STATUS.QUEUED) {
    await taskService.markRun(run.id, {
      status: taskService.RUN_STATUS.RUNNING,
      progress: 5,
      startedAt: now,
      lastMessage: 'Starting script',
      logAppend: `[${now.toISOString()}] Starting script ${run.scriptId}\n`
    });
    await markDeviceStatus(run.deviceId, 'busy');
    await taskService.refreshTaskStatus(run.taskId);
    return;
  }

  // Already running; simulate progress
  const isOnline = Math.random() <= config.simulation.onlineRate;
  if (!isOnline) {
    await taskService.markRun(run.id, {
      status: taskService.RUN_STATUS.FAILED,
      progress: 100,
      lastMessage: 'Device offline',
      finishedAt: now,
      logAppend: `[${now.toISOString()}] Device offline, aborting task\n`
    });
    await markDeviceStatus(run.deviceId, 'offline');
    await taskService.refreshTaskStatus(run.taskId);
    return;
  }

  const increment = Math.floor(Math.random() * 20) + 5; // 5-24%
  const nextProgress = Math.min(100, (run.progress || 0) + increment);
  const failureRoll =
    Math.random() > config.simulation.successRate && nextProgress > 40;

  if (failureRoll) {
    await taskService.markRun(run.id, {
      status: taskService.RUN_STATUS.FAILED,
      progress: 100,
      lastMessage: 'Step failed (simulated)',
      finishedAt: now,
      logAppend: `[${now.toISOString()}] Step failed while executing script\n`
    });
    await markDeviceStatus(run.deviceId, 'online');
    await taskService.refreshTaskStatus(run.taskId);
    return;
  }

  if (nextProgress >= 100) {
    await taskService.markRun(run.id, {
      status: taskService.RUN_STATUS.SUCCESS,
      progress: 100,
      lastMessage: 'Completed',
      finishedAt: now,
      logAppend: `[${now.toISOString()}] Script completed successfully\n`
    });
    await markDeviceStatus(run.deviceId, 'online');
    await taskService.refreshTaskStatus(run.taskId);
    return;
  }

  await taskService.markRun(run.id, {
    status: taskService.RUN_STATUS.RUNNING,
    progress: nextProgress,
    lastMessage: 'Running',
    logAppend: `[${now.toISOString()}] Progress ${nextProgress}%\n`
  });
  await markDeviceStatus(run.deviceId, 'busy');
  await taskService.refreshTaskStatus(run.taskId);
}

async function tick() {
  try {
    const runs = await taskService.fetchPendingRuns(
      config.simulation.batchLimit
    );
    if (!runs.length) {
      return;
    }

    await Promise.all(runs.map((run) => processRun(run)));
  } catch (err) {
    console.error('Task runner error', err);
  }
}

function start() {
  if (timer) return;
  timer = setInterval(tick, config.simulation.tickMs);
  tick();
  console.log(
    `Task runner started (tick ${config.simulation.tickMs}ms, successRate ${config.simulation.successRate})`
  );
}

module.exports = {
  start
};
