import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function EscalationMatrix() {
  const [rows, setRows] = useState([]);
  const [authorityOptions, setAuthorityOptions] = useState([]);
  const [form, setForm] = useState({ escalation_id: '', escalation_name: '', time_duration: '', authority_id: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { fetchRows(); fetchAuthorities(); }, []);

  const fetchRows = async () => {
    try {
      const res = await axios.get('/api/escalation');
      setRows(res.data || []);
    } catch (err) { console.error('fetchRows', err); }
  };

  const fetchAuthorities = async () => {
    try {
      const res = await axios.get('/api/user_responsibility');
      setAuthorityOptions(res.data || []);
    } catch (err) { console.error('fetchAuthorities', err); }
  };

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/escalation/${editingId}`, form);
      } else {
        await axios.post('/api/escalation', form);
      }
      setForm({ escalation_id: '', escalation_name: '', time_duration: '', authority_id: '' });
      setEditingId(null);
      fetchRows();
    } catch (err) { console.error('save escalation', err); }
  };

  const handleEdit = r => {
    setEditingId(r.id);
    setForm({ escalation_id: r.escalation_id || r.escalationId || '', escalation_name: r.escalation_name || r.escalationName || '', time_duration: r.time_duration || r.timeDuration || '', authority_id: r.authority_id || r.authority_id || '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this escalation rule?')) return;
    try { await axios.delete(`/api/escalation/${id}`); fetchRows(); } catch (err) { console.error('delete escalation', err); }
  };

  return (
    <div className="card p-3">
      <h4>Escalation Matrix</h4>
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="form-row">
          <div className="form-group col-md-3">
            <label>Escalation ID</label>
            <input name="escalation_id" className="form-control" value={form.escalation_id} onChange={handleChange} required />
          </div>
          <div className="form-group col-md-4">
            <label>Escalation Name</label>
            <input name="escalation_name" className="form-control" value={form.escalation_name} onChange={handleChange} required />
          </div>
          <div className="form-group col-md-2">
            <label>Time Duration</label>
            <input name="time_duration" className="form-control" value={form.time_duration} onChange={handleChange} placeholder="e.g. 24h" />
          </div>
          <div className="form-group col-md-3">
            <label>Authority (Responsibility)</label>
            <select name="authority_id" className="form-control" value={form.authority_id} onChange={handleChange}>
              <option value="">-- select --</option>
              {authorityOptions.map(a => (
                <option key={a.id} value={a.id}>{a.resp_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <button className="btn btn-primary btn-sm" type="submit">{editingId ? 'Update' : 'Create'}</button>
          {editingId && <button className="btn btn-secondary btn-sm ml-2" type="button" onClick={() => { setEditingId(null); setForm({ escalation_id: '', escalation_name: '', time_duration: '', authority_id: '' }); }}>Cancel</button>}
        </div>
      </form>

      <div className='custom-table-responsive'>
        <table className='table table-sm table-bordered'>
          <thead>
            <tr>
              <th>Escalation ID</th>
              <th>Name</th>
              <th>Time Duration</th>
              <th>Authority</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.escalation_id || r.escalationId}</td>
                <td>{r.escalation_name || r.escalationName}</td>
                <td>{r.time_duration || r.timeDuration}</td>
                <td>
                  {(authorityOptions.find(a => String(a.id) === String(r.authority_id)) || {}).resp_name || ''}</td>
                  
                <td>
                  <button className='btn btn-sm btn-link' onClick={() => handleEdit(r)}>Edit</button>
                  <button className='btn btn-sm btn-link text-danger' onClick={() => handleDelete(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
