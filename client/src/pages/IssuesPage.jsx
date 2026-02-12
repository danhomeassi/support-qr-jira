import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const STATUS_STYLES = {
  Open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'In Progress': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'Awaiting Info': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};
const PRIORITY_STYLES = {
  High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};
const SLA_STYLES = {
  'On Track': 'text-green-600', 'At Risk': 'text-amber-600', Breached: 'text-red-600', Met: 'text-green-600',
};

export default function IssuesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dropdowns, setDropdowns] = useState({});
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);

  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const limit = 25;

  const fetchIssues = useCallback(() => {
    setLoading(true);
    const params = { page, limit, search, status, priority, sort: 'updated_at', order: 'DESC' };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    api.get('/issues', { params })
      .then(res => { setIssues(res.data.data); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  }, [page, search, status, priority]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  useEffect(() => {
    Promise.all([
      api.get('/admin/dropdowns'),
      api.get('/admin/customers'),
      api.get('/users', { params: { active: true } }),
    ]).then(([d, c, u]) => {
      const grouped = {};
      d.data.forEach(opt => {
        if (!grouped[opt.field_name]) grouped[opt.field_name] = [];
        grouped[opt.field_name].push(opt);
      });
      setDropdowns(grouped);
      setCustomers(c.data);
      setUsers(u.data);
    });
  }, []);

  const updateSearch = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    p.set('page', '1');
    setSearchParams(p);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    const token = localStorage.getItem('token');
    window.open(`/api/export/issues?${params.toString()}&token=${token}`, '_blank');
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Issues</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            Export CSV
          </button>
          <Link to="/issues/new" className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
            New Issue
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search issues..."
          value={search}
          onChange={(e) => updateSearch('search', e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <select value={status} onChange={(e) => updateSearch('status', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          <option value="">All Statuses</option>
          {(dropdowns.status || []).map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
        </select>
        <select value={priority} onChange={(e) => updateSearch('priority', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          <option value="">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Priority</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Customer</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Assigned To</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Days Open</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 hidden xl:table-cell">SLA</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 hidden xl:table-cell">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : issues.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No issues found</td></tr>
            ) : issues.map(issue => (
              <tr key={issue.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  ISS-{String(issue.id).padStart(4, '0')}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/issues/${issue.id}`} className="font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400">
                    {issue.title}
                  </Link>
                  <div className="mt-0.5 flex gap-2 sm:hidden">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[issue.status] || ''}`}>{issue.status}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[issue.priority] || ''}`}>{issue.priority}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[issue.status] || ''}`}>{issue.status}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLES[issue.priority] || ''}`}>{issue.priority}</span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{issue.customer_name || '—'}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{issue.assigned_to_name || '—'}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{issue.days_open}d</td>
                <td className={`px-4 py-3 hidden xl:table-cell text-xs font-medium ${SLA_STYLES[issue.sla_status] || 'text-gray-400'}`}>
                  {issue.sla_status || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 hidden xl:table-cell">
                  {issue.updated_at ? new Date(issue.updated_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => updateSearch('page', String(page - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
            >
              Previous
            </button>
            <button
              onClick={() => updateSearch('page', String(page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
