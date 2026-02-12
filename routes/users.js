import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/users — list all users (any authenticated user can see the list for assignment)
router.get('/', authenticate, (req, res) => {
  try {
    const { active } = req.query;
    let query = 'SELECT id, username, email, full_name, role, active, created_at FROM users';
    const params = [];
    if (active !== undefined) {
      query += ' WHERE active = ?';
      params.push(active === 'true' ? 1 : 0);
    }
    query += ' ORDER BY full_name';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — admin create user
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { username, email, password, full_name, role } = req.body;
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'All fields required: username, email, password, full_name' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(username, email, hash, full_name, role || 'user');

    res.status(201).json({ id: result.lastInsertRowid, message: 'User created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — admin update user
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { username, email, password, full_name, role, active } = req.body;

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

    db.prepare(`
      UPDATE users SET username = ?, email = ?, password_hash = ?,
        full_name = ?, role = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      username ?? user.username,
      email ?? user.email,
      hash,
      full_name ?? user.full_name,
      role ?? user.role,
      active !== undefined ? (active ? 1 : 0) : user.active,
      req.params.id
    );

    res.json({ message: 'User updated' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
