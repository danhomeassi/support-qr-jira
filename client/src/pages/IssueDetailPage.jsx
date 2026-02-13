import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  'On Track': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'At Risk': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Breached: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Met: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function IssueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [issue, setIssue] = useState(null);
  const [activity, setActivity] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [commentText, setCommentText] = useState('');
  const [dropdowns, setDropdowns] = useState({});
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  const load = () => {
    Promise.all([
      api.get(`/issues/${id}`),
      api.get(`/issues/${id}/activity`),
      api.get(`/issues/${id}/attachments`),
    ]).then(([i, act, a]) => {
      setIssue(i.data);
      setActivity(act.data);
      setAttachments(a.data);
      setForm({
        title: i.data.title, description: i.data.description || '',
        status: i.data.status, priority: i.data.priority,
        issue_type: i.data.issue_type || '', customer_id: i.data.customer_id || '',
        part_affected: i.data.part_affected || '', unit_affected: i.data.unit_affected || '',
        engineering_change: i.data.engineering_change || '',
        assigned_to: i.data.assigned_to || '',
      });
      const cfv = {};
      (i.data.custom_fields || []).forEach(f => { if (f.value) cfv[f.id] = f.value; });
      setCustomFieldValues(cfv);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

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
      setCustomers(c.data.filter(c => c.active));
      setUsers(u.data);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, custom_fields: customFieldValues };
      if (payload.customer_id) payload.customer_id = parseInt(payload.customer_id);
      if (payload.assigned_to) payload.assigned_to = parseInt(payload.assigned_to);
      else payload.assigned_to = null;
      if (!payload.customer_id) payload.customer_id = null;
      await api.put(`/issues/${id}`, payload);
      setEditing(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await api.post(`/issues/${id}/comments`, { content: commentText });
      setCommentText('');
      // Refresh activity feed to include new comment + its audit entry
      const res = await api.get(`/issues/${id}/activity`);
      setActivity(res.data);
    } catch (err) {
      alert('Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.delete(`/issues/${id}/comments/${commentId}`);
      setActivity(activity.filter(a => !(a.type === 'comment' && a.id === commentId)));
    } catch (err) {
      alert('Failed to delete comment');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/issues/${id}/attachments`, formData);
      const res = await api.get(`/issues/${id}/attachments`);
      setAttachments(res.data);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    }
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attId) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await api.delete(`/attachments/${attId}`);
      setAttachments(attachments.filter(a => a.id !== attId));
    } catch (err) {
      alert('Failed to delete');
    }
  };

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!issue) return <div className="text-gray-500">Issue not found</div>;

  const issueNum = `ISS-${String(issue.id).padStart(4, '0')}`;
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button onClick={() => navigate('/issues')} className="mb-2 text-sm text-accent-600 hover:text-accent-700 dark:text-accent-400">
            &larr; Back to Issues
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            <span className="text-gray-400">{issueNum}</span> {issue.title}
          </h1>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
              Edit
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-300">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</h2>
            {editing ? (
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">
                {issue.description || 'No description provided'}
              </p>
            )}
          </div>

          {/* Custom Fields */}
          {issue.custom_fields?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Additional Fields</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {issue.custom_fields.map(field => (
                  <div key={field.id}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{field.label}</p>
                    {editing ? (
                      field.field_type === 'dropdown' ? (
                        <select value={customFieldValues[field.id] || ''}
                          onChange={(e) => setCustomFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                          <option value="">Select...</option>
                        </select>
                      ) : (
                        <input type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                          value={customFieldValues[field.id] || ''}
                          onChange={(e) => setCustomFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      )
                    ) : (
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{field.value || '—'}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Activity ({activity.length})
            </h2>
            <div className="space-y-3">
              {activity.map((item, idx) => (
                item.type === 'comment' ? (
                  /* Comment */
                  <div key={`c-${item.id}`} className="rounded-lg border border-gray-100 p-4 dark:border-gray-700">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-700 dark:bg-accent-900/30 dark:text-accent-400">
                          {item.full_name?.charAt(0)}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{item.full_name}</span>
                        <span className="text-xs text-gray-400">@{item.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                        {(item.user_id === user?.id || user?.role === 'admin') && (
                          <button onClick={() => handleDeleteComment(item.id)}
                            className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{item.content}</p>
                  </div>
                ) : (
                  /* Activity / audit log entry */
                  <div key={`a-${item.id}`} className="flex items-start gap-3 py-2">
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                      {item.action === 'created' ? (
                        <svg className="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      ) : item.action === 'status_changed' ? (
                        <svg className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      ) : item.action === 'assigned' ? (
                        <svg className="h-3.5 w-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      ) : item.action === 'commented' ? (
                        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                      ) : (
                        <svg className="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-900 dark:text-white">{item.full_name || 'System'}</span>
                        {' '}{item.content}
                      </p>
                      <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                )
              ))}
              {activity.length === 0 && (
                <p className="text-sm text-gray-400">No activity yet</p>
              )}
            </div>

            <form onSubmit={handleComment} className="mt-4 flex gap-2">
              <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              <button type="submit"
                className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
                Send
              </button>
            </form>
          </div>

          {/* Attachments */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Attachments ({attachments.length})
              </h2>
              <button onClick={() => fileInput.current?.click()}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Upload File
              </button>
              <input ref={fileInput} type="file" className="hidden" onChange={handleUpload} />
            </div>
            <div className="space-y-2">
              {attachments.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{a.original_name}</p>
                      <p className="text-xs text-gray-400">
                        {a.full_name} &middot; {(a.size / 1024).toFixed(0)} KB &middot; {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={`/api/attachments/${a.id}/download`}
                      className="text-xs text-accent-600 hover:text-accent-700 dark:text-accent-400">
                      Download
                    </a>
                    {(a.user_id === user?.id || user?.role === 'admin') && (
                      <button onClick={() => handleDeleteAttachment(a.id)}
                        className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    )}
                  </div>
                </div>
              ))}
              {attachments.length === 0 && <p className="text-sm text-gray-400">No attachments</p>}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Details</h2>
            <div className="space-y-3">
              <Field label="Status">
                {editing ? (
                  <select value={form.status} onChange={(e) => set('status', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    {(dropdowns.status || []).map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
                  </select>
                ) : (
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[issue.status]}`}>
                    {issue.status}
                  </span>
                )}
              </Field>
              <Field label="Priority">
                {editing ? (
                  <select value={form.priority} onChange={(e) => set('priority', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                  </select>
                ) : (
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLES[issue.priority]}`}>
                    {issue.priority}
                  </span>
                )}
              </Field>
              <Field label="Type">
                {editing ? (
                  <select value={form.issue_type} onChange={(e) => set('issue_type', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="">None</option>
                    {(dropdowns.issue_type || []).map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-gray-900 dark:text-white">{issue.issue_type || '—'}</span>
                )}
              </Field>
              <Field label="Customer">
                {editing ? (
                  <select value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="">None</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-gray-900 dark:text-white">{issue.customer_name || '—'}</span>
                )}
              </Field>
              <Field label="Assigned To">
                {editing ? (
                  <select value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-gray-900 dark:text-white">{issue.assigned_to_name || 'Unassigned'}</span>
                )}
              </Field>
              <Field label="Part Affected">
                {editing ? (
                  <select value={form.part_affected} onChange={(e) => set('part_affected', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="">None</option>
                    {(dropdowns.part_affected || []).map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-gray-900 dark:text-white">{issue.part_affected || '—'}</span>
                )}
              </Field>
              <Field label="Unit Affected">
                {editing ? (
                  <select value={form.unit_affected} onChange={(e) => set('unit_affected', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="">None</option>
                    {(dropdowns.unit_affected || []).map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-gray-900 dark:text-white">{issue.unit_affected || '—'}</span>
                )}
              </Field>
              <Field label="Engineering Change">
                {editing ? (
                  <input type="text" value={form.engineering_change} onChange={(e) => set('engineering_change', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                ) : (
                  <span className="text-sm text-gray-900 dark:text-white">{issue.engineering_change || '—'}</span>
                )}
              </Field>
            </div>
          </div>

          {/* Dates & SLA */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Timeline & SLA</h2>
            <div className="space-y-3">
              <Field label="Opened">{new Date(issue.open_date).toLocaleDateString()}</Field>
              <Field label="Last Updated">{new Date(issue.updated_at).toLocaleDateString()}</Field>
              {issue.closed_date && (
                <Field label="Closed">{new Date(issue.closed_date).toLocaleDateString()}</Field>
              )}
              <Field label="Days Open">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{issue.days_open} days</span>
              </Field>
              {issue.sla_status && (
                <Field label="SLA Status">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${SLA_STYLES[issue.sla_status]}`}>
                    {issue.sla_status} {issue.sla_target ? `(${issue.sla_target}d target)` : ''}
                  </span>
                </Field>
              )}
              <Field label="Created By">{issue.created_by_name}</Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
