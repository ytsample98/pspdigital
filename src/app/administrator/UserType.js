import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function UserType() {
  const [types, setTypes] = useState([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchTypes(); }, []);
  const fetchTypes = async () => { const res = await axios.get('/api/user_type'); setTypes(res.data || []); };

  const save = async () => {
    if (!name) return alert('Provide a type name');
    if (editing) {
      await axios.put(`/api/user_type/${editing}`, { type_name: name });
    } else {
      await axios.post('/api/user_type', { type_name: name });
    }
    setName(''); setEditing(null); fetchTypes();
  };

  const edit = (t) => { setName(t.type_name); setEditing(t.id); };
  const remove = async (id) => { if (!window.confirm('Delete type?')) return; await axios.delete(`/api/user_type/${id}`); fetchTypes(); };

  return (
    <div className="card full-height">
      <div style={{ padding: 16 }}>
        <h4>User Types</h4>
        <div className="form-row align-items-center mb-3">
          <div className="col"><input className="form-control form-control-sm" placeholder="Type name (e.g. TL, VSL, OE)" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="col-auto"><button className="btn btn-primary btn-sm" onClick={save}>{editing ? 'Update' : 'Create'}</button></div>
        </div>
        <table className="table table-sm table-bordered">
          <thead><tr><th>Type</th><th>Actions</th></tr></thead>
          <tbody>
            {types.map(t=> (
              <tr key={t.id}><td>{t.type_name}</td><td><button className="btn btn-sm btn-link" onClick={()=>edit(t)}>Edit</button> <button className="btn btn-sm btn-link text-danger" onClick={()=>remove(t.id)}>Delete</button></td></tr>
            ))}
            {types.length===0 && <tr><td colSpan="2">No types</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
