import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PAGE_OPTIONS = [
  { key: 'administrator', label: 'Administrator' },
  { key: 'psclist', label: 'PSC List' },
  { key: 'rootcause', label: 'Root Cause' },
  { key: 'effect', label: 'Effectiveness Check' },
  { key: 'corrective', label: 'Corrective Actions' }
];

export default function UserResponsibility() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [pages, setPages] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchItems(); }, []);
  const fetchItems = async () => { const res = await axios.get('/api/user_responsibility'); setItems(res.data || []); };

  const togglePage = (k) => {
    if (pages.includes(k)) setPages(pages.filter(p=>p!==k)); else setPages([...pages, k]);
  };

  const save = async () => {
    if (!name) return alert('Provide responsibility name');
    const payload = { resp_name: name, pages: JSON.stringify(pages) };
    if (editing) await axios.put(`/api/user_responsibility/${editing}`, payload);
    else await axios.post('/api/user_responsibility', payload);
    setName(''); setPages([]); setEditing(null); fetchItems();
  };

  const edit = (it) => { setName(it.resp_name); try { setPages(JSON.parse(it.pages || '[]')); } catch(e){ setPages([]);} setEditing(it.id); };
  const remove = async (id) => { if (!window.confirm('Delete?')) return; await axios.delete(`/api/user_responsibility/${id}`); fetchItems(); };

  return (
    <div className="card full-height">
      <div style={{ padding: 16 }}>
        <h4>User Responsibilities</h4>
        <div className="form-row align-items-center mb-2">
          <div className="col-md-4"><input className="form-control form-control-sm" placeholder="Responsibility name" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="col-md-6">
            {PAGE_OPTIONS.map(p=> (
              <label className="mr-2" key={p.key}><input type="checkbox" checked={pages.includes(p.key)} onChange={()=>togglePage(p.key)} /> {' '}{p.label}</label>
            ))}
          </div>
          <div className="col-auto"><button className="btn btn-primary btn-sm" onClick={save}>{editing ? 'Update' : 'Create'}</button></div>
        </div>

        <table className="table table-sm table-bordered">
          <thead><tr>
            <th>Responsibility</th>
            <th>Pages</th>
            <th>Actions</th>
            </tr></thead>
          <tbody>
            {items.map(it=> (
              <tr key={it.id}>
                <td>{it.resp_name}</td>
                <td style={{maxWidth:300, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{(() => { try { return JSON.parse(it.pages||'[]').join(', '); } catch(e){ return it.pages; } })()}</td>
                <td><button className="btn btn-sm btn-link" onClick={()=>edit(it)}>Edit</button> <button className="btn btn-sm btn-link text-danger" onClick={()=>remove(it.id)}>Delete</button></td></tr>
            ))}
            {items.length===0 && <tr><td colSpan="3">No responsibilities</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
