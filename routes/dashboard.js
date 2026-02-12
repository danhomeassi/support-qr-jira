import { Router } from 'express';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', authenticate, (req, res) => {
  try {
    const totalOpen = db.prepare(
      "SELECT COUNT(*) as count FROM issues WHERE status NOT IN ('Closed', 'Resolved')"
    ).get().count;

    const totalClosed = db.prepare(
      "SELECT COUNT(*) as count FROM issues WHERE status IN ('Closed', 'Resolved')"
    ).get().count;

    const highPriority = db.prepare(
      "SELECT COUNT(*) as count FROM issues WHERE priority = 'High' AND status NOT IN ('Closed', 'Resolved')"
    ).get().count;

    const avgDaysOpen = db.prepare(`
      SELECT ROUND(AVG(
        julianday(COALESCE(closed_date, datetime('now'))) - julianday(open_date)
      ), 1) as avg
      FROM issues WHERE status NOT IN ('Closed', 'Resolved')
    `).get().avg || 0;

    // SLA stats
    const slaIssues = db.prepare(`
      SELECT i.priority,
        CAST(ROUND(julianday(COALESCE(i.closed_date, datetime('now'))) - julianday(i.open_date)) AS INTEGER) as days_open,
        c.sla_high, c.sla_medium, c.sla_low,
        i.status
      FROM issues i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.status NOT IN ('Closed', 'Resolved')
    `).all();

    let slaBreached = 0;
    let slaAtRisk = 0;
    let slaOnTrack = 0;
    for (const issue of slaIssues) {
      let target;
      if (issue.priority === 'High') target = issue.sla_high;
      else if (issue.priority === 'Medium') target = issue.sla_medium;
      else target = issue.sla_low;

      const ratio = issue.days_open / target;
      if (ratio >= 1) slaBreached++;
      else if (ratio >= 0.8) slaAtRisk++;
      else slaOnTrack++;
    }

    // Issues opened this week
    const openedThisWeek = db.prepare(`
      SELECT COUNT(*) as count FROM issues
      WHERE open_date >= date('now', '-7 days')
    `).get().count;

    // Issues closed this week
    const closedThisWeek = db.prepare(`
      SELECT COUNT(*) as count FROM issues
      WHERE closed_date >= date('now', '-7 days')
    `).get().count;

    res.json({
      totalOpen,
      totalClosed,
      highPriority,
      avgDaysOpen,
      slaBreached,
      slaAtRisk,
      slaOnTrack,
      openedThisWeek,
      closedThisWeek,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/charts
router.get('/charts', authenticate, (req, res) => {
  try {
    // Issues by status
    const byStatus = db.prepare(
      'SELECT status as name, COUNT(*) as value FROM issues GROUP BY status'
    ).all();

    // Issues by priority
    const byPriority = db.prepare(
      'SELECT priority as name, COUNT(*) as value FROM issues GROUP BY priority'
    ).all();

    // Issues by customer (top 10)
    const byCustomer = db.prepare(`
      SELECT c.name, COUNT(*) as value
      FROM issues i
      JOIN customers c ON i.customer_id = c.id
      GROUP BY c.name
      ORDER BY value DESC
      LIMIT 10
    `).all();

    // Issues by assignee
    const byAssignee = db.prepare(`
      SELECT u.full_name as name, COUNT(*) as value
      FROM issues i
      JOIN users u ON i.assigned_to = u.id
      WHERE i.status NOT IN ('Closed', 'Resolved')
      GROUP BY u.full_name
      ORDER BY value DESC
    `).all();

    // Trend: issues opened/closed per week (last 12 weeks)
    const trend = db.prepare(`
      WITH weeks AS (
        SELECT date('now', '-' || (value * 7) || ' days', 'weekday 1') as week_start
        FROM (
          SELECT 0 as value UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
          UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
          UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
        )
      )
      SELECT
        w.week_start as week,
        (SELECT COUNT(*) FROM issues WHERE date(open_date) >= w.week_start AND date(open_date) < date(w.week_start, '+7 days')) as opened,
        (SELECT COUNT(*) FROM issues WHERE date(closed_date) >= w.week_start AND date(closed_date) < date(w.week_start, '+7 days')) as closed
      FROM weeks w
      ORDER BY w.week_start ASC
    `).all();

    res.json({ byStatus, byPriority, byCustomer, byAssignee, trend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
