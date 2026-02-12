import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

// GET /api/issues/:issueId/attachments
router.get('/issues/:issueId/attachments', authenticate, (req, res) => {
  try {
    const attachments = db.prepare(`
      SELECT a.*, u.full_name, u.username
      FROM attachments a
      JOIN users u ON a.user_id = u.id
      WHERE a.issue_id = ?
      ORDER BY a.created_at DESC
    `).all(req.params.issueId);
    res.json(attachments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/issues/:issueId/attachments
router.post('/issues/:issueId/attachments', authenticate, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const issue = db.prepare('SELECT id FROM issues WHERE id = ?').get(req.params.issueId);
    if (!issue) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Issue not found' });
    }

    const result = db.prepare(`
      INSERT INTO attachments (issue_id, user_id, filename, original_name, mime_type, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.params.issueId, req.user.id, req.file.filename,
      req.file.originalname, req.file.mimetype, req.file.size
    );

    db.prepare("UPDATE issues SET updated_at = datetime('now') WHERE id = ?")
      .run(req.params.issueId);

    res.status(201).json({
      id: result.lastInsertRowid,
      filename: req.file.filename,
      original_name: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attachments/:id/download
router.get('/attachments/:id/download', authenticate, (req, res) => {
  try {
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    const filePath = path.join(uploadDir, attachment.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(filePath, attachment.original_name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/attachments/:id
router.delete('/attachments/:id', authenticate, (req, res) => {
  try {
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    if (attachment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const filePath = path.join(uploadDir, attachment.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
