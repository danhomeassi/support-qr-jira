import { Router } from 'express';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/export/issues — CSV download
router.get('/issues', authenticate, (req, res) => {
  try {
    const { status, priority, customer_id, assigned_to, search } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(i.title LIKE ? OR i.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) { conditions.push('i.status = ?'); params.push(status); }
    if (priority) { conditions.push('i.priority = ?'); params.push(priority); }
    if (customer_id) { conditions.push('i.customer_id = ?'); params.push(customer_id); }
    if (assigned_to) { conditions.push('i.assigned_to = ?'); params.push(assigned_to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const issues = db.prepare(`
      SELECT
        i.id,
        i.title,
        i.description,
        i.status,
        i.priority,
        i.issue_type,
        c.name as customer,
        i.part_affected,
        i.unit_affected,
        i.engineering_change,
        u1.full_name as assigned_to,
        u2.full_name as created_by,
        i.open_date,
        i.closed_date,
        CAST(ROUND(julianday(COALESCE(i.closed_date, datetime('now'))) - julianday(i.open_date)) AS INTEGER) as days_open,
        i.updated_at as last_updated
      FROM issues i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u1 ON i.assigned_to = u1.id
      LEFT JOIN users u2 ON i.created_by = u2.id
      ${where}
      ORDER BY i.id DESC
    `).all(...params);

    // Get custom fields
    const customFields = db.prepare('SELECT * FROM custom_fields WHERE active = 1 ORDER BY sort_order').all();

    // Get custom field values for all issues
    const customValues = {};
    if (customFields.length > 0) {
      const allValues = db.prepare(`
        SELECT issue_id, custom_field_id, value FROM issue_custom_fields
      `).all();
      for (const v of allValues) {
        if (!customValues[v.issue_id]) customValues[v.issue_id] = {};
        customValues[v.issue_id][v.custom_field_id] = v.value;
      }
    }

    // Build CSV
    const baseHeaders = [
      'Issue Number', 'Title', 'Description', 'Status', 'Priority', 'Type',
      'Customer', 'Part Affected', 'Unit Affected', 'Engineering Change',
      'Assigned To', 'Created By', 'Open Date', 'Closed Date', 'Days Open', 'Last Updated'
    ];
    const customHeaders = customFields.map(f => f.label);
    const headers = [...baseHeaders, ...customHeaders];

    const escapeCSV = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = issues.map(issue => {
      const base = [
        `ISS-${String(issue.id).padStart(4, '0')}`,
        issue.title, issue.description, issue.status, issue.priority,
        issue.issue_type, issue.customer, issue.part_affected, issue.unit_affected,
        issue.engineering_change, issue.assigned_to, issue.created_by,
        issue.open_date, issue.closed_date, issue.days_open, issue.last_updated
      ];
      const custom = customFields.map(f =>
        customValues[issue.id]?.[f.id] || ''
      );
      return [...base, ...custom].map(escapeCSV).join(',');
    });

    const csv = [headers.map(escapeCSV).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="issues-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
