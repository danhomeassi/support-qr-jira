import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function CreateIssuePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', priority: 'Medium', issue_type: '',
    customer_id: '', part_affected: '', unit_affected: '',
    engineering_change: '', assigned_to: '',
  });
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [dropdowns, setDropdowns] = useState({});
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/admin/dropdowns'),
      api.get('/admin/customers'),
      api.get('/users', { params: { active: true } }),
      api.get('/admin/custom-fields'),
    ]).then(([d, c, u, cf]) => {
      const grouped = {};
      d.data.forEach(opt => {
        if (!grouped[opt.field_name]) grouped[opt.field_name] = [];
        if (opt.active) grouped[opt.field_name].push(opt);
      });
      setDropdowns(grouped);
      setCustomers(c.data.filter(c => c.active));
      setUsers(u.data);
      setCustomFields(cf.data.filter(f => f.active));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, custom_fields: customFieldValues };
      if (payload.customer_id) payload.customer_id = parseInt(payload.customer_id);
      if (payload.assigned_to) payload.assigned_to = parseInt(payload.assigned_to);
      else delete payload.assigned_to;
      if (!payload.customer_id) delete payload.customer_id;

      const res = await api.post('/issues', payload);
      navigate(`/issues/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create issue');
    } finally {
      setLoading(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Create New Issue</h1>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>
        )}

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Title *</label>
          <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} required
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
            <select value={form.issue_type} onChange={(e) => set('issue_type', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="">Select type...</option>
              {(dropdowns.issue_type || []).map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
            <select value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="">Select customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Assigned To</label>
            <select value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Part Affected</label>
            <select value={form.part_affected} onChange={(e) => set('part_affected', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="">Select part...</option>
              {(dropdowns.part_affected || []).map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Unit Affected</label>
            <select value={form.unit_affected} onChange={(e) => set('unit_affected', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="">Select unit...</option>
              {(dropdowns.unit_affected || []).map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Engineering Change</label>
          <input type="text" value={form.engineering_change} onChange={(e) => set('engineering_change', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </div>

        {/* Dynamic custom fields */}
        {customFields.length > 0 && (
          <div className="mb-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Additional Fields</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {customFields.map(field => (
                <div key={field.id}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {field.label} {field.required ? '*' : ''}
                  </label>
                  {field.field_type === 'textarea' ? (
                    <textarea
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                      required={!!field.required}
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  ) : field.field_type === 'dropdown' ? (
                    <select
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                      required={!!field.required}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select...</option>
                      {(field.options || []).filter(o => o.active).map(o => (
                        <option key={o.id} value={o.value}>{o.value}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                      required={!!field.required}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Issue'}
          </button>
          <button type="button" onClick={() => navigate('/issues')}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
