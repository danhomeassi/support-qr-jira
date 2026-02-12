import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import api from '../services/api';

const STATUS_COLORS = { Open: '#3b82f6', 'In Progress': '#6366f1', 'Awaiting Info': '#f59e0b', Resolved: '#22c55e', Closed: '#6b7280' };
const PRIORITY_COLORS = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/charts'),
    ]).then(([s, c]) => {
      setStats(s.data);
      setCharts(c.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <Link to="/issues/new" className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
          New Issue
        </Link>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Open Issues" value={stats?.totalOpen} color="text-blue-600" />
        <StatCard label="High Priority" value={stats?.highPriority} color="text-red-600" />
        <StatCard label="Avg Days Open" value={stats?.avgDaysOpen} color="text-amber-600" />
        <StatCard label="SLA Breached" value={stats?.slaBreached} color="text-red-600" />
        <StatCard label="Closed This Week" value={stats?.closedThisWeek} color="text-green-600" />
      </div>

      {/* SLA summary */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm text-green-600 dark:text-green-400">SLA On Track</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats?.slaOnTrack || 0}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm text-amber-600 dark:text-amber-400">SLA At Risk</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats?.slaAtRisk || 0}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">SLA Breached</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats?.slaBreached || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Issues by Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Issues by Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={charts?.byStatus || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {(charts?.byStatus || []).map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Issues by Priority */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Issues by Priority</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts?.byPriority || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Issues">
                {(charts?.byPriority || []).map((entry) => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Weekly Trend (Last 12 Weeks)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={charts?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tickFormatter={(v) => v?.slice(5)} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="opened" stroke="#3b82f6" strokeWidth={2} name="Opened" />
              <Line type="monotone" dataKey="closed" stroke="#22c55e" strokeWidth={2} name="Closed" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* By Customer */}
        {charts?.byCustomer?.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Issues by Customer</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.byCustomer} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" name="Issues" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* By Assignee */}
        {charts?.byAssignee?.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Open Issues by Assignee</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.byAssignee} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" name="Issues" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value ?? 0}</p>
    </div>
  );
}
