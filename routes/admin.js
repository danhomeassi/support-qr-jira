import { Router } from 'express';
import db from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── Dropdown Options ──

// GET /api/admin/dropdowns
router.get('/dropdowns', authenticate, (req, res) => {
  try {
    const { field_name } = req.query;
    let query = 'SELECT * FROM dropdown_options';
    const params = [];
    if (field_name) {
      query += ' WHERE field_name = ?';
      params.push(field_name);
    }
    query += ' ORDER BY field_name, sort_order, value';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/dropdowns
router.post('/dropdowns', authenticate, requireAdmin, (req, res) => {
  try {
    const { field_name, value } = req.body;
    if (!field_name || !value) {
      return res.status(400).json({ error: 'field_name and value required' });
    }
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as max FROM dropdown_options WHERE field_name = ?'
    ).get(field_name);
    const result = db.prepare(
      'INSERT INTO dropdown_options (field_name, value, sort_order) VALUES (?, ?, ?)'
    ).run(field_name, value, (maxOrder?.max ?? -1) + 1);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Option already exists for this field' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/dropdowns/:id
router.put('/dropdowns/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { value, active, sort_order } = req.body;
    const existing = db.prepare('SELECT * FROM dropdown_options WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Option not found' });

    db.prepare('UPDATE dropdown_options SET value = ?, active = ?, sort_order = ? WHERE id = ?')
      .run(value ?? existing.value, active !== undefined ? (active ? 1 : 0) : existing.active,
        sort_order ?? existing.sort_order, req.params.id);
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/dropdowns/:id
router.delete('/dropdowns/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM dropdown_options WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Custom Fields ──

// GET /api/admin/custom-fields
router.get('/custom-fields', authenticate, (req, res) => {
  try {
    const fields = db.prepare('SELECT * FROM custom_fields ORDER BY sort_order, label').all();
    // Attach options for dropdown fields
    const getOptions = db.prepare(
      'SELECT * FROM custom_field_options WHERE custom_field_id = ? ORDER BY sort_order, value'
    );
    const enriched = fields.map(f => ({
      ...f,
      options: f.field_type === 'dropdown' ? getOptions.all(f.id) : [],
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/custom-fields
router.post('/custom-fields', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, label, field_type, required, options } = req.body;
    if (!name || !label || !field_type) {
      return res.status(400).json({ error: 'name, label, and field_type required' });
    }

    const result = db.prepare(
      'INSERT INTO custom_fields (name, label, field_type, required) VALUES (?, ?, ?, ?)'
    ).run(name, label, field_type, required ? 1 : 0);

    const fieldId = result.lastInsertRowid;

    // Add options for dropdown fields
    if (field_type === 'dropdown' && Array.isArray(options)) {
      const insert = db.prepare(
        'INSERT INTO custom_field_options (custom_field_id, value, sort_order) VALUES (?, ?, ?)'
      );
      options.forEach((opt, i) => insert.run(fieldId, opt, i));
    }

    res.status(201).json({ id: fieldId });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Field name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/custom-fields/:id
router.put('/custom-fields/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Custom field not found' });

    const { label, required, active, sort_order, options } = req.body;

    db.prepare(
      'UPDATE custom_fields SET label = ?, required = ?, active = ?, sort_order = ? WHERE id = ?'
    ).run(
      label ?? existing.label,
      required !== undefined ? (required ? 1 : 0) : existing.required,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      sort_order ?? existing.sort_order,
      req.params.id
    );

    // Replace options if provided
    if (Array.isArray(options) && existing.field_type === 'dropdown') {
      db.prepare('DELETE FROM custom_field_options WHERE custom_field_id = ?').run(req.params.id);
      const insert = db.prepare(
        'INSERT INTO custom_field_options (custom_field_id, value, sort_order) VALUES (?, ?, ?)'
      );
      options.forEach((opt, i) => insert.run(req.params.id, opt, i));
    }

    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/custom-fields/:id
router.delete('/custom-fields/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM custom_field_options WHERE custom_field_id = ?').run(req.params.id);
    db.prepare('DELETE FROM issue_custom_fields WHERE custom_field_id = ?').run(req.params.id);
    db.prepare('DELETE FROM custom_fields WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Customers ──

// GET /api/admin/customers
router.get('/customers', authenticate, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM customers ORDER BY name').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/customers
router.post('/customers', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, sla_high, sla_medium, sla_low } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name required' });

    const result = db.prepare(
      'INSERT INTO customers (name, sla_high, sla_medium, sla_low) VALUES (?, ?, ?, ?)'
    ).run(name, sla_high ?? 3, sla_medium ?? 7, sla_low ?? 14);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Customer already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/customers/:id
router.put('/customers/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const { name, sla_high, sla_medium, sla_low, active } = req.body;
    db.prepare(
      'UPDATE customers SET name = ?, sla_high = ?, sla_medium = ?, sla_low = ?, active = ? WHERE id = ?'
    ).run(
      name ?? existing.name,
      sla_high ?? existing.sla_high,
      sla_medium ?? existing.sla_medium,
      sla_low ?? existing.sla_low,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      req.params.id
    );
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
