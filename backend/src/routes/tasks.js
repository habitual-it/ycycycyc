const express = require('express');
const taskService = require('../services/taskService');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const tasks = await taskService.listTasks();
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/runs', async (req, res, next) => {
  try {
    const runs = await taskService.listTaskRuns(req.params.id);
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { scriptId, deviceIds, payload, createdBy } = req.body;
    if (!scriptId || !deviceIds || !deviceIds.length) {
      return res.status(400).json({ message: 'scriptId and deviceIds are required' });
    }

    const [script] = await db.query('SELECT id FROM scripts WHERE id = ?', [scriptId]);
    if (!script) {
      return res.status(400).json({ message: 'scriptId is invalid' });
    }

    const placeholders = deviceIds.map(() => '?').join(', ');
    const devices = await db.query(
      `SELECT id FROM devices WHERE id IN (${placeholders})`,
      deviceIds
    );
    if (devices.length !== deviceIds.length) {
      return res.status(400).json({ message: 'One or more deviceIds are invalid' });
    }

    const task = await taskService.createTask({
      scriptId,
      deviceIds,
      payload,
      createdBy
    });

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/retry', async (req, res, next) => {
  try {
    await taskService.retryFailedRuns(req.params.id);
    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
