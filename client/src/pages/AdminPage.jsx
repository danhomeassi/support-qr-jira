import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import api from '../services/api';

const TABS = ['Users', 'Customers', 'Dropdowns', 'Custom Fields'];

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Users');

  if (user?.role !== 'admin') {
    return <div className="text-center text-red-500 mt-8">Admin access required</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-accent-600 text-accent-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Users' && <UsersTab />}
      {tab === 'Customers' && <CustomersTab />}
      {tab === 'Dropdowns' && <DropdownsTab />}
      {tab === 'Custom Fields' && <CustomFieldsTab />}
    </div>
  );
}

/* ────────── Users Tab ────────── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', role: 'user' });
  const [error, setError] = useState('');

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editUser) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editUser.id}`, payload);
      } else {
        await api.post('/users', form);
      }
      setModal(false);
      setEditUser(null);
      setForm({ username: '', email: '', password: '', full_name: '', role: 'user' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ username: u.username, email: u.email, password: '', full_name: u.full_name, role: u.role });
    setModal(true);
  };

  const toggleActive = async (u) => {
    await api.put(`/users/${u.id}`, { active: !u.active });
    load();
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button onClick={() => { setEditUser(null); setForm({ username: '', email: '', password: '', full_name: '', role: 'user' }); setModal(true); }}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
          Add User
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Username</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {users.map(u => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{u.username}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(u)} className="text-xs text-accent-600 hover:text-accent-700">Edit</button>
                    <button onClick={() => toggleActive(u)} className="text-xs text-amber-600 hover:text-amber-700">
                      {u.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editUser ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}
          <Input label="Full Name" value={form.full_name} onChange={(v) => setForm(f => ({ ...f, full_name: v }))} required />
          <Input label="Username" value={form.username} onChange={(v) => setForm(f => ({ ...f, username: v }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} required />
          <Input label={editUser ? 'New Password (leave blank to keep)' : 'Password'} type="password" value={form.password}
            onChange={(v) => setForm(f => ({ ...f, password: v }))} required={!editUser} />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="w-full rounded-lg bg-accent-600 py-2.5 text-sm font-medium text-white hover:bg-accent-700">
            {editUser ? 'Save Changes' : 'Create User'}
          </button>
        </form>
      </Modal>
    </>
  );
}

/* ────────── Customers Tab ────────── */
function CustomersTab() {
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', sla_high: 3, sla_medium: 7, sla_low: 14 });
  const [error, setError] = useState('');

  const load = () => api.get('/admin/customers').then(r => setCustomers(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editItem) await api.put(`/admin/customers/${editItem.id}`, form);
      else await api.post('/admin/customers', form);
      setModal(false);
      setEditItem(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const openEdit = (c) => {
    setEditItem(c);
    setForm({ name: c.name, sla_high: c.sla_high, sla_medium: c.sla_medium, sla_low: c.sla_low });
    setModal(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button onClick={() => { setEditItem(null); setForm({ name: '', sla_high: 3, sla_medium: 7, sla_low: 14 }); setModal(true); }}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
          Add Customer
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">SLA High (days)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">SLA Medium</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">SLA Low</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {customers.map(c => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                <td className="px-4 py-3 text-red-600">{c.sla_high}d</td>
                <td className="px-4 py-3 text-amber-600">{c.sla_medium}d</td>
                <td className="px-4 py-3 text-green-600">{c.sla_low}d</td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(c)} className="text-xs text-accent-600 hover:text-accent-700">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}
          <Input label="Customer Name" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} required />
          <div className="grid grid-cols-3 gap-3">
            <Input label="SLA High" type="number" value={form.sla_high} onChange={(v) => setForm(f => ({ ...f, sla_high: parseInt(v) || 0 }))} />
            <Input label="SLA Medium" type="number" value={form.sla_medium} onChange={(v) => setForm(f => ({ ...f, sla_medium: parseInt(v) || 0 }))} />
            <Input label="SLA Low" type="number" value={form.sla_low} onChange={(v) => setForm(f => ({ ...f, sla_low: parseInt(v) || 0 }))} />
          </div>
          <p className="text-xs text-gray-400">SLA targets in days for each priority level</p>
          <button type="submit" className="w-full rounded-lg bg-accent-600 py-2.5 text-sm font-medium text-white hover:bg-accent-700">
            {editItem ? 'Save Changes' : 'Add Customer'}
          </button>
        </form>
      </Modal>
    </>
  );
}

/* ────────── Dropdowns Tab ────────── */
function DropdownsTab() {
  const [options, setOptions] = useState([]);
  const [selectedField, setSelectedField] = useState('issue_type');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState('');

  const load = () => api.get('/admin/dropdowns').then(r => setOptions(r.data));
  useEffect(() => { load(); }, []);

  const fields = [...new Set(options.map(o => o.field_name))];
  const filtered = options.filter(o => o.field_name === selectedField);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    setError('');
    try {
      await api.post('/admin/dropdowns', { field_name: selectedField, value: newValue.trim() });
      setNewValue('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this option?')) return;
    await api.delete(`/admin/dropdowns/${id}`);
    load();
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Field:</label>
        <select value={selectedField} onChange={(e) => setSelectedField(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          {fields.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        <div className="mb-4 space-y-2">
          {filtered.map(opt => (
            <div key={opt.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700">
              <span className="text-sm text-gray-900 dark:text-white">{opt.value}</span>
              <button onClick={() => handleDelete(opt.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400">No options for this field</p>}
        </div>

        <form onSubmit={handleAdd} className="flex gap-2">
          <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Add new option..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          <button type="submit" className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">Add</button>
        </form>
      </div>
    </div>
  );
}

/* ────────── Custom Fields Tab ────────── */
function CustomFieldsTab() {
  const [fields, setFields] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', label: '', field_type: 'text', required: false, options: '' });
  const [error, setError] = useState('');

  const load = () => api.get('/admin/custom-fields').then(r => setFields(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name: form.name.toLowerCase().replace(/\s+/g, '_'),
        label: form.label,
        field_type: form.field_type,
        required: form.required,
        options: form.field_type === 'dropdown'
          ? form.options.split('\n').map(s => s.trim()).filter(Boolean)
          : undefined,
      };
      await api.post('/admin/custom-fields', payload);
      setModal(false);
      setForm({ name: '', label: '', field_type: 'text', required: false, options: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const toggleActive = async (field) => {
    await api.put(`/admin/custom-fields/${field.id}`, { active: !field.active });
    load();
  };

  const handleDelete = async (field) => {
    if (!confirm(`Delete custom field "${field.label}"? This will remove all stored values.`)) return;
    await api.delete(`/admin/custom-fields/${field.id}`);
    load();
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setModal(true)}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
          Add Custom Field
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Label</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Field Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Required</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {fields.map(f => (
              <tr key={f.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{f.label}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs hidden sm:table-cell">{f.name}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{f.field_type}</td>
                <td className="px-4 py-3">{f.required ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {f.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(f)} className="text-xs text-amber-600 hover:text-amber-700">
                      {f.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => handleDelete(f)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {fields.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No custom fields defined yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Custom Field">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}
          <Input label="Label (display name)" value={form.label} onChange={(v) => setForm(f => ({ ...f, label: v, name: v.toLowerCase().replace(/\s+/g, '_') }))} required />
          <Input label="Field Name (internal)" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} required />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Field Type</label>
            <select value={form.field_type} onChange={(e) => setForm(f => ({ ...f, field_type: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="text">Text</option>
              <option value="textarea">Text Area</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="dropdown">Dropdown</option>
            </select>
          </div>
          {form.field_type === 'dropdown' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Options (one per line)</label>
              <textarea value={form.options} onChange={(e) => setForm(f => ({ ...f, options: e.target.value }))} rows={4}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.required} onChange={(e) => setForm(f => ({ ...f, required: e.target.checked }))}
              className="rounded border-gray-300" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
          </label>
          <button type="submit" className="w-full rounded-lg bg-accent-600 py-2.5 text-sm font-medium text-white hover:bg-accent-700">
            Create Field
          </button>
        </form>
      </Modal>
    </>
  );
}

/* ────────── Shared Input Component ────────── */
function Input({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
    </div>
  );
}
