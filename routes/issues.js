import { Router } from 'express';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';
import { sendIssueOpenedEmail, sendIssueClosedEmail } from '../utils/email.js';

const router = Router();

// GET /api/issues — list with search, filter, pagination
router.get('/', authenticate, (req, res) => {
  try {
    const {
      search, status, priority, issue_type, customer_id,
      assigned_to, page = 1, limit = 25, sort = 'updated_at', order = 'DESC'
    } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(
        `(i.title LIKE ? OR i.description LIKE ? OR CAST(i.id AS TEXT) LIKE ?)`
      );
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (status) { conditions.push('i.status = ?'); params.push(status); }
    if (priority) { conditions.push('i.priority = ?'); params.push(priority); }
    if (issue_type) { conditions.push('i.issue_type = ?'); params.push(issue_type); }
    if (customer_id) { conditions.push('i.customer_id = ?'); params.push(customer_id); }
    if (assigned_to) { conditions.push('i.assigned_to = ?'); params.push(assigned_to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts = ['id', 'title', 'status', 'priority', 'open_date', 'updated_at', 'closed_date'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'updated_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM issues i ${where}`
    ).get(...params).count;

    const issues = db.prepare(`
      SELECT i.*,
        c.name as customer_name,
        u1.full_name as assigned_to_name,
        u2.full_name as created_by_name,
        c.sla_high, c.sla_medium, c.sla_low,
        CAST(
          ROUND(julianday(COALESCE(i.closed_date, datetime('now'))) - julianday(i.open_date))
        AS INTEGER) as days_open
      FROM issues i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u1 ON i.assigned_to = u1.id
      LEFT JOIN users u2 ON i.created_by = u2.id
      ${where}
      ORDER BY i.${sortCol} ${sortOrder}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Calculate SLA status for each issue
    const enriched = issues.map(issue => {
      let sla_target = null;
      let sla_status = null;
      if (issue.customer_id) {
        if (issue.priority === 'High') sla_target = issue.sla_high;
        else if (issue.priority === 'Medium') sla_target = issue.sla_medium;
        else sla_target = issue.sla_low;

        if (sla_target) {
          const ratio = issue.days_open / sla_target;
          if (issue.status === 'Closed' || issue.status === 'Resolved') {
            sla_status = issue.days_open <= sla_target ? 'Met' : 'Breached';
          } else if (ratio >= 1) {
            sla_status = 'Breached';
          } else if (ratio >= 0.8) {
            sla_status = 'At Risk';
          } else {
            sla_status = 'On Track';
          }
        }
      }
      const { sla_high, sla_medium, sla_low, ...rest } = issue;
      return { ...rest, sla_target, sla_status };
    });

    res.json({ data: enriched, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/issues/:id
router.get('/:id', authenticate, (req, res) => {
  try {
    const issue = db.prepare(`
      SELECT i.*,
        c.name as customer_name,
        u1.full_name as assigned_to_name, u1.username as assigned_to_username,
        u2.full_name as created_by_name,
        c.sla_high, c.sla_medium, c.sla_low,
        CAST(
          ROUND(julianday(COALESCE(i.closed_date, datetime('now'))) - julianday(i.open_date))
        AS INTEGER) as days_open
      FROM issues i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u1 ON i.assigned_to = u1.id
      LEFT JOIN users u2 ON i.created_by = u2.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    // SLA calculation
    let sla_target = null, sla_status = null;
    if (issue.customer_id) {
      if (issue.priority === 'High') sla_target = issue.sla_high;
      else if (issue.priority === 'Medium') sla_target = issue.sla_medium;
      else sla_target = issue.sla_low;

      if (sla_target) {
        const ratio = issue.days_open / sla_target;
        if (issue.status === 'Closed' || issue.status === 'Resolved') {
          sla_status = issue.days_open <= sla_target ? 'Met' : 'Breached';
        } else if (ratio >= 1) sla_status = 'Breached';
        else if (ratio >= 0.8) sla_status = 'At Risk';
        else sla_status = 'On Track';
      }
    }

    // Get custom field values
    const customFields = db.prepare(`
      SELECT cf.id, cf.name, cf.label, cf.field_type, cf.required, icf.value
      FROM custom_fields cf
      LEFT JOIN issue_custom_fields icf ON icf.custom_field_id = cf.id AND icf.issue_id = ?
      WHERE cf.active = 1
      ORDER BY cf.sort_order
    `).all(req.params.id);

    const { sla_high, sla_medium, sla_low, ...rest } = issue;
    res.json({ ...rest, sla_target, sla_status, custom_fields: customFields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/issues
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      title, description, priority, issue_type, customer_id,
      part_affected, unit_affected, engineering_change, assigned_to,
      custom_fields
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = db.prepare(`
      INSERT INTO issues (title, description, priority, issue_type, customer_id,
        part_affected, unit_affected, engineering_change, assigned_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description || null, priority || 'Medium', issue_type || null,
      customer_id || null, part_affected || null, unit_affected || null,
      engineering_change || null, assigned_to || null, req.user.id
    );

    const issueId = result.lastInsertRowid;

    // Save custom field values
    if (custom_fields && typeof custom_fields === 'object') {
      const upsert = db.prepare(`
        INSERT INTO issue_custom_fields (issue_id, custom_field_id, value)
        VALUES (?, ?, ?)
        ON CONFLICT(issue_id, custom_field_id) DO UPDATE SET value = excluded.value
      `);
      for (const [fieldId, value] of Object.entries(custom_fields)) {
        upsert.run(issueId, parseInt(fieldId), value || null);
      }
    }

    // Audit log
    db.prepare('INSERT INTO audit_log (issue_id, user_id, action, details) VALUES (?, ?, ?, ?)')
      .run(issueId, req.user.id, 'created', `Issue created: ${title}`);

    // Send email notification
    const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
    const creator = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const assignee = assigned_to
      ? db.prepare('SELECT * FROM users WHERE id = ?').get(assigned_to)
      : null;
    sendIssueOpenedEmail({ issue, creator, assignee }).catch(() => {});

    res.status(201).json({ id: issueId, message: 'Issue created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/issues/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Issue not found' });

    const {
      title, description, status, priority, issue_type, customer_id,
      part_affected, unit_affected, engineering_change, assigned_to,
      custom_fields
    } = req.body;

    // Check if issue is being closed
    const isClosing = status && (status === 'Closed' || status === 'Resolved')
      && existing.status !== 'Closed' && existing.status !== 'Resolved';
    const isReopening = status && status !== 'Closed' && status !== 'Resolved'
      && (existing.status === 'Closed' || existing.status === 'Resolved');

    const closedDate = isClosing ? new Date().toISOString() : (isReopening ? null : existing.closed_date);

    db.prepare(`
      UPDATE issues SET
        title = ?, description = ?, status = ?, priority = ?, issue_type = ?,
        customer_id = ?, part_affected = ?, unit_affected = ?,
        engineering_change = ?, assigned_to = ?, closed_date = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title ?? existing.title,
      description ?? existing.description,
      status ?? existing.status,
      priority ?? existing.priority,
      issue_type ?? existing.issue_type,
      customer_id ?? existing.customer_id,
      part_affected ?? existing.part_affected,
      unit_affected ?? existing.unit_affected,
      engineering_change ?? existing.engineering_change,
      assigned_to ?? existing.assigned_to,
      closedDate,
      req.params.id
    );

    // Update custom fields
    if (custom_fields && typeof custom_fields === 'object') {
      const upsert = db.prepare(`
        INSERT INTO issue_custom_fields (issue_id, custom_field_id, value)
        VALUES (?, ?, ?)
        ON CONFLICT(issue_id, custom_field_id) DO UPDATE SET value = excluded.value
      `);
      for (const [fieldId, value] of Object.entries(custom_fields)) {
        upsert.run(parseInt(req.params.id), parseInt(fieldId), value || null);
      }
    }

    // Build detailed change log — one audit entry per field changed
    const logChange = db.prepare(
      'INSERT INTO audit_log (issue_id, user_id, action, details) VALUES (?, ?, ?, ?)'
    );
    const resolveUser = (id) => {
      if (!id) return 'Unassigned';
      const u = db.prepare('SELECT full_name FROM users WHERE id = ?').get(id);
      return u?.full_name || `User #${id}`;
    };
    const resolveCustomer = (id) => {
      if (!id) return 'None';
      const c = db.prepare('SELECT name FROM customers WHERE id = ?').get(id);
      return c?.name || `Customer #${id}`;
    };

    const newTitle = title ?? existing.title;
    const newDesc = description ?? existing.description;
    const newStatus = status ?? existing.status;
    const newPriority = priority ?? existing.priority;
    const newType = issue_type ?? existing.issue_type;
    const newCust = customer_id ?? existing.customer_id;
    const newPart = part_affected ?? existing.part_affected;
    const newUnit = unit_affected ?? existing.unit_affected;
    const newEC = engineering_change ?? existing.engineering_change;
    const newAssignee = assigned_to ?? existing.assigned_to;

    let changeCount = 0;
    if (newTitle !== existing.title) {
      logChange.run(req.params.id, req.user.id, 'field_changed', `Title changed from "${existing.title}" to "${newTitle}"`);
      changeCount++;
    }
    if (newDesc !== existing.description) {
      logChange.run(req.params.id, req.user.id, 'field_changed', 'Description updated');
      changeCount++;
    }
    if (newStatus !== existing.status) {
      logChange.run(req.params.id, req.user.id, 'status_changed', `Status changed from "${existing.status}" to "${newStatus}"`);
      changeCount++;
    }
    if (newPriority !== existing.priority) {
      logChange.run(req.params.id, req.user.id, 'field_changed', `Priority changed from "${existing.priority}" to "${newPriority}"`);
      changeCount++;
    }
    if (newType !== existing.issue_type) {
      logChange.run(req.params.id, req.user.id, 'field_changed', `Type changed from "${existing.issue_type || 'None'}" to "${newType || 'None'}"`);
      changeCount++;
    }
    if (String(newCust || '') !== String(existing.customer_id || '')) {
      logChange.run(req.params.id, req.user.id, 'field_changed', `Customer changed from "${resolveCustomer(existing.customer_id)}" to "${resolveCustomer(newCust)}"`);
      changeCount++;
    }
    if (newPart !== existing.part_affected) {
      logChange.run(req.params.id, req.user.id, 'field_changed', `Part Affected changed from "${existing.part_affected || 'None'}" to "${newPart || 'None'}"`);
      changeCount++;
    }
    if (newUnit !== existing.unit_affected) {
      logChange.run(req.params.id, req.user.id, 'field_changed', `Unit Affected changed from "${existing.unit_affected || 'None'}" to "${newUnit || 'None'}"`);
      changeCount++;
    }
    if (newEC !== existing.engineering_change) {
      logChange.run(req.params.id, req.user.id, 'field_changed', `Engineering Change changed from "${existing.engineering_change || 'None'}" to "${newEC || 'None'}"`);
      changeCount++;
    }
    if (String(newAssignee || '') !== String(existing.assigned_to || '')) {
      logChange.run(req.params.id, req.user.id, 'assigned', `Assigned to changed from "${resolveUser(existing.assigned_to)}" to "${resolveUser(newAssignee)}"`);
      changeCount++;
    }
    if (changeCount === 0) {
      logChange.run(req.params.id, req.user.id, 'updated', 'Issue updated (no field changes detected)');
    }

    // Send close email
    if (isClosing) {
      const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
      const closedBy = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      const assignee = issue.assigned_to
        ? db.prepare('SELECT * FROM users WHERE id = ?').get(issue.assigned_to)
        : null;
      const creator = db.prepare('SELECT * FROM users WHERE id = ?').get(issue.created_by);
      sendIssueClosedEmail({ issue, closedBy, assignee, creator }).catch(() => {});
    }

    res.json({ message: 'Issue updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/issues/:id — admin only
router.delete('/:id', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const result = db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Issue not found' });
    res.json({ message: 'Issue deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
