import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import db from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'issues.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const upload = multer({
  dest: BACKUP_DIR,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

const router = Router();

// GET /api/admin/backup — download the SQLite database file
router.get('/backup', authenticate, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `issues-backup-${timestamp}.db`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fs.statSync(DB_PATH).size);

    const stream = fs.createReadStream(DB_PATH);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/backup/json — export all data as JSON (portable backup)
router.get('/backup/json', authenticate, requireAdmin, (req, res) => {
  try {
    const data = {
      exported_at: new Date().toISOString(),
      version: 1,
      users: db.prepare('SELECT * FROM users').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      dropdown_options: db.prepare('SELECT * FROM dropdown_options').all(),
      custom_fields: db.prepare('SELECT * FROM custom_fields').all(),
      custom_field_options: db.prepare('SELECT * FROM custom_field_options').all(),
      issues: db.prepare('SELECT * FROM issues').all(),
      issue_custom_fields: db.prepare('SELECT * FROM issue_custom_fields').all(),
      comments: db.prepare('SELECT * FROM comments').all(),
      attachments: db.prepare('SELECT * FROM attachments').all(),
      audit_log: db.prepare('SELECT * FROM audit_log').all(),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="issues-backup-${timestamp}.json"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/restore/json — restore from JSON backup
router.post('/restore/json', authenticate, requireAdmin, upload.single('file'), (req, res) => {
  const tmpPath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const raw = fs.readFileSync(tmpPath, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.version || !data.users || !data.issues) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    // Restore inside a transaction for safety
    const restore = db.transaction(() => {
      // Clear all tables (order matters due to foreign keys)
      db.exec(`
        DELETE FROM audit_log;
        DELETE FROM issue_custom_fields;
        DELETE FROM comments;
        DELETE FROM attachments;
        DELETE FROM issues;
        DELETE FROM custom_field_options;
        DELETE FROM custom_fields;
        DELETE FROM dropdown_options;
        DELETE FROM customers;
        DELETE FROM users;
      `);

      // Restore users
      const insertUser = db.prepare(
        `INSERT INTO users (id, username, email, password_hash, full_name, role, active, reset_token, reset_token_expires, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const u of data.users) {
        insertUser.run(u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.active, u.reset_token, u.reset_token_expires, u.created_at, u.updated_at);
      }

      // Restore customers
      const insertCustomer = db.prepare(
        `INSERT INTO customers (id, name, sla_high, sla_medium, sla_low, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const c of data.customers) {
        insertCustomer.run(c.id, c.name, c.sla_high, c.sla_medium, c.sla_low, c.active, c.created_at);
      }

      // Restore dropdown_options
      const insertDropdown = db.prepare(
        `INSERT INTO dropdown_options (id, field_name, value, active, sort_order) VALUES (?, ?, ?, ?, ?)`
      );
      for (const d of data.dropdown_options) {
        insertDropdown.run(d.id, d.field_name, d.value, d.active, d.sort_order);
      }

      // Restore custom_fields
      const insertCF = db.prepare(
        `INSERT INTO custom_fields (id, name, label, field_type, required, active, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const f of data.custom_fields) {
        insertCF.run(f.id, f.name, f.label, f.field_type, f.required, f.active, f.sort_order, f.created_at);
      }

      // Restore custom_field_options
      const insertCFO = db.prepare(
        `INSERT INTO custom_field_options (id, custom_field_id, value, active, sort_order) VALUES (?, ?, ?, ?, ?)`
      );
      for (const o of (data.custom_field_options || [])) {
        insertCFO.run(o.id, o.custom_field_id, o.value, o.active, o.sort_order);
      }

      // Restore issues
      const insertIssue = db.prepare(
        `INSERT INTO issues (id, title, description, status, priority, issue_type, customer_id, part_affected, unit_affected, engineering_change, assigned_to, created_by, open_date, closed_date, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const i of data.issues) {
        insertIssue.run(i.id, i.title, i.description, i.status, i.priority, i.issue_type, i.customer_id, i.part_affected, i.unit_affected, i.engineering_change, i.assigned_to, i.created_by, i.open_date, i.closed_date, i.updated_at);
      }

      // Restore issue_custom_fields
      const insertICF = db.prepare(
        `INSERT INTO issue_custom_fields (id, issue_id, custom_field_id, value) VALUES (?, ?, ?, ?)`
      );
      for (const v of (data.issue_custom_fields || [])) {
        insertICF.run(v.id, v.issue_id, v.custom_field_id, v.value);
      }

      // Restore comments
      const insertComment = db.prepare(
        `INSERT INTO comments (id, issue_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`
      );
      for (const c of data.comments) {
        insertComment.run(c.id, c.issue_id, c.user_id, c.content, c.created_at);
      }

      // Restore attachments (metadata only — files need separate backup)
      const insertAttachment = db.prepare(
        `INSERT INTO attachments (id, issue_id, user_id, filename, original_name, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const a of (data.attachments || [])) {
        insertAttachment.run(a.id, a.issue_id, a.user_id, a.filename, a.original_name, a.mime_type, a.size, a.created_at);
      }

      // Restore audit_log
      const insertAudit = db.prepare(
        `INSERT INTO audit_log (id, issue_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const a of (data.audit_log || [])) {
        insertAudit.run(a.id, a.issue_id, a.user_id, a.action, a.details, a.created_at);
      }
    });

    restore();

    res.json({
      message: 'Restore completed',
      counts: {
        users: data.users.length,
        customers: data.customers.length,
        issues: data.issues.length,
        comments: data.comments.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  } finally {
    // Clean up temp file
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

// GET /api/admin/backup/status — database stats
router.get('/backup/status', authenticate, requireAdmin, (req, res) => {
  try {
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      customers: db.prepare('SELECT COUNT(*) as count FROM customers').get().count,
      issues: db.prepare('SELECT COUNT(*) as count FROM issues').get().count,
      comments: db.prepare('SELECT COUNT(*) as count FROM comments').get().count,
      attachments: db.prepare('SELECT COUNT(*) as count FROM attachments').get().count,
      db_size_mb: fs.existsSync(DB_PATH)
        ? (fs.statSync(DB_PATH).size / (1024 * 1024)).toFixed(2)
        : '0',
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
