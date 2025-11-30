const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');

const router = express.Router();

const normalizeSteps = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return [];
    }
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return [];
    }
  }
  return [];
};

const normalizeScript = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  steps: normalizeSteps(row.steps),
  version: row.version,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.query(
      'SELECT * FROM scripts ORDER BY created_at DESC LIMIT 200'
    );
    const scripts = rows.map((row) => {
      try {
        return normalizeScript(row);
      } catch (e) {
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          steps: [],
          version: row.version,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      }
    });
    res.json(scripts);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM scripts WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Script not found' });
    }
    try {
      res.json(normalizeScript(rows[0]));
    } catch (e) {
      res.json({
        id: rows[0].id,
        name: rows[0].name,
        description: rows[0].description,
        steps: [],
        version: rows[0].version,
        createdBy: rows[0].created_by,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at
      });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description = '', steps = [], version = 1, createdBy } =
      req.body;
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }
    const id = randomUUID();
    const now = new Date();
    await db.query(
      `INSERT INTO scripts
        (id, name, description, steps, version, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description, JSON.stringify(steps), version, createdBy || 'system', now]
    );

    const [created] = await db.query('SELECT * FROM scripts WHERE id = ?', [id]);
    res.status(201).json(normalizeScript(created));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, steps, version, createdBy } = req.body;
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (steps !== undefined) {
      fields.push('steps = ?');
      params.push(JSON.stringify(steps));
    }
    if (version !== undefined) {
      fields.push('version = ?');
      params.push(version);
    }
    if (createdBy !== undefined) {
      fields.push('created_by = ?');
      params.push(createdBy);
    }

    if (!fields.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    fields.push('updated_at = ?');
    params.push(new Date(), id);

    const sql = `UPDATE scripts SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, params);

    const rows = await db.query('SELECT * FROM scripts WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Script not found' });
    }
    res.json(normalizeScript(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
