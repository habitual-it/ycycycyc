const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');

const router = express.Router();

const parseTags = (raw) => {
  if (!raw) return [];
  // MySQL may return JSON as string; accept comma-separated fallback
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        // fall through to comma split
      }
    }
    return trimmed.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
};

const normalizeDevice = (row) => ({
  id: row.id,
  name: row.name,
  model: row.model,
  osVersion: row.os_version,
  resolution: row.resolution,
  tags: parseTags(row.tags),
  status: row.status,
  onlineProbability: Number(row.online_probability),
  lastSeen: row.last_seen,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

router.get('/', async (req, res, next) => {
  try {
    const { status, tag } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (tag) {
      conditions.push('JSON_CONTAINS(tags, ?)');
      params.push(JSON.stringify(tag));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.query(
      `SELECT * FROM devices ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(rows.map(normalizeDevice));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      model,
      osVersion,
      resolution,
      tags = [],
      status = 'online',
      onlineProbability = 0.85
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }

    const tagList = Array.isArray(tags)
      ? tags
      : parseTags(typeof tags === 'string' ? tags : '');

    const id = randomUUID();
    const now = new Date();
    await db.query(
      `INSERT INTO devices
        (id, name, model, os_version, resolution, tags, status, online_probability, last_seen, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        model || '',
        osVersion || '',
        resolution || '',
        JSON.stringify(tagList),
        status,
        onlineProbability,
        now,
        now,
        now
      ]
    );

    const [created] = await db.query('SELECT * FROM devices WHERE id = ?', [id]);
    res.status(201).json(normalizeDevice(created));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      model,
      osVersion,
      resolution,
      tags,
      status,
      onlineProbability
    } = req.body;

    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (model !== undefined) {
      fields.push('model = ?');
      params.push(model);
    }
    if (osVersion !== undefined) {
      fields.push('os_version = ?');
      params.push(osVersion);
    }
    if (resolution !== undefined) {
      fields.push('resolution = ?');
      params.push(resolution);
    }
    if (tags !== undefined) {
      fields.push('tags = ?');
      params.push(JSON.stringify(parseTags(tags)));
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }
    if (onlineProbability !== undefined) {
      fields.push('online_probability = ?');
      params.push(onlineProbability);
    }

    if (!fields.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    fields.push('updated_at = ?');
    params.push(new Date());
    params.push(id);

    const sql = `UPDATE devices SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, params);

    const rows = await db.query('SELECT * FROM devices WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.json(normalizeDevice(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }

    await db.query(
      'UPDATE devices SET status = ?, updated_at = ? WHERE id = ?',
      [status, new Date(), id]
    );
    const rows = await db.query('SELECT * FROM devices WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.json(normalizeDevice(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
