const { randomUUID } = require('crypto');
const db = require('../db');

const TASK_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL_FAILED: 'partial_failed'
};

const RUN_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed'
};

const normalizeTask = (row) => ({
  id: row.id,
  scriptId: row.script_id,
  payload: row.payload ? JSON.parse(row.payload) : {},
  targetDevices: row.target_devices ? JSON.parse(row.target_devices) : [],
  status: row.status,
  progress: Number(row.progress || 0),
  createdBy: row.created_by,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  stats: row.stats || undefined
});

const normalizeRun = (row) => ({
  id: row.id,
  taskId: row.task_id,
  deviceId: row.device_id,
  status: row.status,
  progress: Number(row.progress || 0),
  log: row.log || '',
  lastMessage: row.last_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at
});

async function createTask({ scriptId, deviceIds, payload = {}, createdBy }) {
  if (!scriptId || !deviceIds || !deviceIds.length) {
    throw new Error('scriptId and deviceIds are required');
  }
  const now = new Date();
  const taskId = randomUUID();

  await db.withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO tasks
        (id, script_id, payload, target_devices, status, progress, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        scriptId,
        JSON.stringify(payload),
        JSON.stringify(deviceIds),
        TASK_STATUS.QUEUED,
        0,
        createdBy || 'system',
        now,
        now
      ]
    );

    for (const deviceId of deviceIds) {
      await conn.execute(
        `INSERT INTO task_runs
          (id, task_id, device_id, status, progress, log, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          taskId,
          deviceId,
          RUN_STATUS.QUEUED,
          0,
          'Pending\n',
          now,
          now
        ]
      );
    }
  });

  return getTaskById(taskId);
}

async function listTasks({ limit = 50 } = {}) {
  const rows = await db.query(
    `SELECT
        t.*,
        JSON_OBJECT(
          'total', COUNT(tr.id),
          'success', SUM(tr.status = 'success'),
          'failed', SUM(tr.status = 'failed'),
          'running', SUM(tr.status = 'running'),
          'queued', SUM(tr.status = 'queued')
        ) AS stats
     FROM tasks t
     LEFT JOIN task_runs tr ON tr.task_id = t.id
     GROUP BY t.id
     ORDER BY t.created_at DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map((row) => {
    const task = normalizeTask(row);
    task.stats = task.stats ? JSON.parse(task.stats) : null;
    return task;
  });
}

async function getTaskById(id) {
  const rows = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!rows.length) return null;
  const task = normalizeTask(rows[0]);
  const runs = await listTaskRuns(id);
  return { ...task, runs };
}

async function listTaskRuns(taskId) {
  const rows = await db.query(
    'SELECT * FROM task_runs WHERE task_id = ? ORDER BY created_at ASC',
    [taskId]
  );
  return rows.map(normalizeRun);
}

async function markRun(
  runId,
  { status, progress, logAppend, lastMessage, startedAt, finishedAt }
) {
  const fields = [];
  const params = [];

  if (status) {
    fields.push('status = ?');
    params.push(status);
  }
  if (progress !== undefined) {
    fields.push('progress = ?');
    params.push(progress);
  }
  if (logAppend) {
    fields.push('log = CONCAT(IFNULL(log, ""), ?)');
    params.push(logAppend);
  }
  if (lastMessage !== undefined) {
    fields.push('last_message = ?');
    params.push(lastMessage);
  }
  if (startedAt) {
    fields.push('started_at = ?');
    params.push(startedAt);
  }
  if (finishedAt) {
    fields.push('finished_at = ?');
    params.push(finishedAt);
  }

  fields.push('updated_at = ?');
  params.push(new Date(), runId);

  const sql = `UPDATE task_runs SET ${fields.join(', ')} WHERE id = ?`;
  await db.query(sql, params);
}

async function refreshTaskStatus(taskId) {
  const [row] = await db.query(
    `SELECT
        SUM(status = 'success') AS success_count,
        SUM(status = 'failed') AS failed_count,
        SUM(status = 'running') AS running_count,
        COUNT(*) AS total,
        AVG(progress) AS avg_progress
     FROM task_runs
     WHERE task_id = ?`,
    [taskId]
  );
  if (!row || row.total === null) return;

  const stats = {
    success: Number(row.success_count || 0),
    failed: Number(row.failed_count || 0),
    running: Number(row.running_count || 0),
    total: Number(row.total || 0)
  };

  if (stats.total === 0) return;

  const avgProgress = Number(row.avg_progress || 0);
  let status = TASK_STATUS.QUEUED;
  if (stats.failed > 0 && stats.failed < stats.total) {
    status = TASK_STATUS.PARTIAL_FAILED;
  } else if (stats.failed === stats.total) {
    status = TASK_STATUS.FAILED;
  } else if (stats.running > 0) {
    status = TASK_STATUS.RUNNING;
  } else if (stats.success === stats.total) {
    status = TASK_STATUS.SUCCESS;
  } else if (stats.success > 0) {
    status = TASK_STATUS.RUNNING;
  }

  const finished =
    status === TASK_STATUS.SUCCESS ||
    status === TASK_STATUS.FAILED ||
    status === TASK_STATUS.PARTIAL_FAILED;

  await db.query(
    `UPDATE tasks
     SET status = ?, progress = ?, updated_at = ?, finished_at = ?
     WHERE id = ?`,
    [
      status,
      Math.round(avgProgress),
      new Date(),
      finished ? new Date() : null,
      taskId
    ]
  );
}

async function fetchPendingRuns(limit) {
  const rows = await db.query(
    `SELECT tr.*, t.target_devices, t.status as task_status, t.script_id
     FROM task_runs tr
     INNER JOIN tasks t ON t.id = tr.task_id
     WHERE tr.status IN ('queued', 'running')
     ORDER BY tr.created_at ASC
     LIMIT ?`,
    [limit]
  );
  return rows.map((row) => ({
    ...normalizeRun(row),
    taskStatus: row.task_status,
    targetDevices: row.target_devices ? JSON.parse(row.target_devices) : [],
    scriptId: row.script_id
  }));
}

async function retryFailedRuns(taskId) {
  const now = new Date();
  await db.query(
    `UPDATE task_runs
     SET status = ?, progress = 0, log = CONCAT(IFNULL(log, ""), ?), updated_at = ?, finished_at = NULL
     WHERE task_id = ? AND status = 'failed'`,
    [RUN_STATUS.QUEUED, '\nRetrying...\n', now, taskId]
  );

  await db.query(
    `UPDATE tasks
     SET status = ?, progress = 0, updated_at = ?, finished_at = NULL
     WHERE id = ?`,
    [TASK_STATUS.QUEUED, now, taskId]
  );
}

module.exports = {
  TASK_STATUS,
  RUN_STATUS,
  createTask,
  listTasks,
  getTaskById,
  listTaskRuns,
  markRun,
  refreshTaskStatus,
  fetchPendingRuns,
  retryFailedRuns
};
