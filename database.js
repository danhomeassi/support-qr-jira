import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'issues.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// WAL mode for better concurrent read performance with ~50 users
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    active INTEGER DEFAULT 1,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    sla_high INTEGER DEFAULT 3,
    sla_medium INTEGER DEFAULT 7,
    sla_low INTEGER DEFAULT 14,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dropdown_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL,
    value TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(field_name, value)
  );

  CREATE TABLE IF NOT EXISTS custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK(field_type IN ('text', 'number', 'date', 'dropdown', 'textarea')),
    required INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS custom_field_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    custom_field_id INTEGER NOT NULL,
    value TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id)
  );

  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Open',
    priority TEXT DEFAULT 'Medium' CHECK(priority IN ('High', 'Medium', 'Low')),
    issue_type TEXT,
    customer_id INTEGER,
    part_affected TEXT,
    unit_affected TEXT,
    engineering_change TEXT,
    assigned_to INTEGER,
    created_by INTEGER NOT NULL,
    open_date TEXT DEFAULT (datetime('now')),
    closed_date TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS issue_custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    custom_field_id INTEGER NOT NULL,
    value TEXT,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id),
    UNIQUE(issue_id, custom_field_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default admin user if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    `INSERT INTO users (username, email, password_hash, full_name, role)
     VALUES ('admin', 'admin@company.com', ?, 'System Administrator', 'admin')`
  ).run(hash);
  console.log('Default admin created — username: admin, password: admin123');
}

// Seed default dropdown options
const dropdownCount = db.prepare('SELECT COUNT(*) as count FROM dropdown_options').get();
if (dropdownCount.count === 0) {
  const insert = db.prepare(
    'INSERT INTO dropdown_options (field_name, value, sort_order) VALUES (?, ?, ?)'
  );
  const defaults = {
    issue_type: ['Bug', 'Enhancement', 'Customer Complaint', 'Internal Issue', 'Feature Request'],
    status: ['Open', 'In Progress', 'Awaiting Info', 'Resolved', 'Closed'],
    part_affected: ['Hardware', 'Software', 'Firmware', 'Mechanical', 'Electrical', 'Other'],
    unit_affected: ['Unit A', 'Unit B', 'Unit C', 'Other'],
  };
  const seed = db.transaction(() => {
    for (const [field, values] of Object.entries(defaults)) {
      values.forEach((val, i) => insert.run(field, val, i));
    }
  });
  seed();
  console.log('Default dropdown options seeded');
}

export default db;
