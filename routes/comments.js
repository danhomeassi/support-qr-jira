import { Router } from 'express';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/issues/:issueId/comments
router.get('/:issueId/comments', authenticate, (req, res) => {
  try {
    const comments = db.prepare(`
      SELECT c.*, u.full_name, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.issue_id = ?
      ORDER BY c.created_at ASC
    `).all(req.params.issueId);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/issues/:issueId/comments
router.post('/:issueId/comments', authenticate, (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content required' });
    }

    const issue = db.prepare('SELECT id FROM issues WHERE id = ?').get(req.params.issueId);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    const result = db.prepare(
      'INSERT INTO comments (issue_id, user_id, content) VALUES (?, ?, ?)'
    ).run(req.params.issueId, req.user.id, content.trim());

    // Update issue timestamp
    db.prepare("UPDATE issues SET updated_at = datetime('now') WHERE id = ?")
      .run(req.params.issueId);

    db.prepare('INSERT INTO audit_log (issue_id, user_id, action, details) VALUES (?, ?, ?, ?)')
      .run(req.params.issueId, req.user.id, 'commented', 'Added a comment');

    const comment = db.prepare(`
      SELECT c.*, u.full_name, u.username
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/issues/:issueId/comments/:id
router.delete('/:issueId/comments/:id', authenticate, (req, res) => {
  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND issue_id = ?')
      .get(req.params.id, req.params.issueId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Only author or admin can delete
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorised' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/issues/:issueId/activity — combined comments + audit log
router.get('/:issueId/activity', authenticate, (req, res) => {
  try {
    const comments = db.prepare(`
      SELECT c.id, 'comment' as type, c.content, c.created_at,
        u.full_name, u.username, c.user_id
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.issue_id = ?
    `).all(req.params.issueId);

    const auditEntries = db.prepare(`
      SELECT a.id, 'activity' as type, a.action, a.details as content, a.created_at,
        u.full_name, u.username, a.user_id
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.issue_id = ?
    `).all(req.params.issueId);

    // Merge and sort chronologically
    const combined = [...comments, ...auditEntries]
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
