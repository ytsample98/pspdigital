// PSCList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PSCFullView from './PSCFullView';


export default function PSCList() {
  const [pscs, setPscs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selected, setSelected] = useState(null);
  const [masters, setMasters] = useState({ shifts: [], valuestreams: [], lines: [] });
const [searchTerm, setSearchTerm] = useState('');
  const emptyForm = () => ({
    problem_number: '', searchTerm: '', initiator_name: '', date: '', shift: '', value_stream_line: '',
    line_id: '', short_description: '', problem_description: '', qty_affected: '',
    part_affected: '', supplier: '', status: 'Open'
  });

  const [form, setForm] = useState(emptyForm());

  useEffect(() => { fetchPscs(); fetchMasters(); }, []);

  const fetchMasters = async () => {
    try {
      const [s, v, l] = await Promise.all([
        axios.get('/api/shift'),
        axios.get('/api/valuestream'),
        axios.get('/api/line')
      ]);
      const newMasters = { shifts: s.data || [], valuestreams: v.data || [], lines: l.data || [] };
      setMasters(newMasters);
      // If user has the create form open or form.shift is empty, try to auto-detect shift
      if (!form.shift) {
        try {
          const now = new Date();
          const minutes = now.getHours() * 60 + now.getMinutes();
          for (const sh of newMasters.shifts) {
            if (!sh.start_time || !sh.end_time) continue;
            const [shh, shm] = sh.start_time.split(':').map(Number);
            const [ehh, ehm] = sh.end_time.split(':').map(Number);
            const start = shh * 60 + shm;
            const end = ehh * 60 + ehm;
            if (start <= end) {
              if (minutes >= start && minutes < end) { setForm(prev => ({ ...prev, shift: sh.id })); break; }
            } else {
              if (minutes >= start || minutes < end) { setForm(prev => ({ ...prev, shift: sh.id })); break; }
            }
          }
        } catch (e) { /* ignore */ }
      }
    } catch (err) { console.warn('Could not load masters', err); }
  };

  const fetchPscs = async () => {
    const res = await axios.get('/api/psc');
    setPscs(res.data || []);
  };

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const generateProblemNumber = () => {
    // create PSC### based on existing count (simple client-side generation)
    const max = pscs.reduce((acc, p) => {
      const num = parseInt((p.problem_number || p.problemNumber || '').replace(/[^0-9]/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 100);
    return `PSC${(max + 1).toString().padStart(3, '0')}`;
  };

  const detectShift = () => {
    // Determine shift from masters based on current time; masters expected to have start_time/end_time
    try {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      for (const s of masters.shifts) {
        // Accept start_time/end_time as 'HH:MM' strings
        if (!s.start_time || !s.end_time) continue;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        if (start <= end) {
          if (minutes >= start && minutes < end) return s.id;
        } else {
          // overnight shift
          if (minutes >= start || minutes < end) return s.id;
        }
      }
    } catch (e) { /* ignore */ }
    return '';
  };
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const localDate = `${yyyy}-${mm}-${dd}`;
  const handleSubmit = async e => {
    e.preventDefault();
    // Ensure stage/status defaults and problem number/initiator/date
    const user = (() => { try { return JSON.parse(localStorage.getItem('dcmsUser')); } catch(e){return null;} })();
    const payload = {
      // send the normalized field names: shift (id) and line_id (id)
      ...form,
      status: 'Open',
      ticket_stage: 'Plan',
      problem_number: form.problem_number || generateProblemNumber(),
      initiator_name: form.initiator_name || (user && (user.userName || user.username || user.name || user.usermail)) || '',
      // date must be YYYY-MM-DD
      date:  localDate
    };
    await axios.post('/api/psc', payload);
    setForm(emptyForm());
    setShowForm(false);
    fetchPscs();
  };

  const openPreview = (psc) => { setSelected(psc); setShowPreview(true); setShowForm(false); };

  const openFormForCreate = () => {
    const user = (() => { try { return JSON.parse(localStorage.getItem('dcmsUser')); } catch(e){return null;} })();
    setForm({
      ...emptyForm(),
      problem_number: generateProblemNumber(),
      initiator_name: user && (user.userName || user.username || user.name || user.usermail) || '',
      date:  localDate,
      shift: detectShift(),
      line_id: ''
    });
    setShowForm(true);
    setShowPreview(false);
  };

  // Preview UI (simplified from pspform preview)
  const renderPreview = () => {
    if (!selected) return null;
    return (
      <PSCFullView
        psc={selected}
        onClose={() => { setShowPreview(false); setSelected(null); }}
        
      />
    );
  };



  // Filter logic: checks all relevant fields
  const filteredPSCs = pscs.filter(psc => {
    const search = searchTerm.toLowerCase();
    return (
      (psc.problem_number || psc.problemNumber || '').toLowerCase().includes(search) ||
      (psc.initiator_name || psc.initiatorName || '').toLowerCase().includes(search) ||
      (psc.date || '').toLowerCase().includes(search) ||
      ((masters.shifts.find(s => String(s.id) === String(psc.shift))?.shift_name || psc.shift || '') + '').toLowerCase().includes(search) ||
      (psc.value_stream_line || psc.valueStreamLine || '').toLowerCase().includes(search) ||
      (psc.ticket_stage || psc.ticketStage || '').toLowerCase().includes(search) ||
      (psc.short_description || psc.shortDescription || '').toLowerCase().includes(search) ||
      (psc.status || '').toLowerCase().includes(search)
    );
  });

  const renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="card-title">Problem Solving Card List</h4>

        <div className="d-flex align-items-center" style={{ gap: '10px', width: '40%' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={openFormForCreate}>
            + Add PSC
          </button>
        </div>
      </div>

      {/* Table */}
      <div className='table-responsive'>
        <table className='table table-bordered table-hover'>
          <thead className='thead-light'>
            <tr style={{ fontSize: '14px' }}>
              <th>Problem No</th>
              <th>Initiator</th>
              <th>Date</th>
              <th>Shift</th>
              <th>Value Stream</th>
              <th>Stage</th>
              <th>Short Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredPSCs.length > 0 ? (
              filteredPSCs.map(psc => (
                <tr key={psc.id}>
                  <td>
                    <button
                      className='btn btn-link p-0'
                      onClick={() => openPreview(psc)}
                    >
                      {psc.problem_number || psc.problemNumber}
                    </button>
                  </td>
                  <td>{psc.initiator_name || psc.initiatorName}</td>
                 <td>{psc.date ? new Date(psc.date).toLocaleDateString('en-CA') : ''}</td>
                  <td>{masters.shifts.find(s => String(s.id) === String(psc.shift))?.shift_name || psc.shift}</td>
                  <td>{psc.value_stream_line}</td>
                  <td>{psc.ticket_stage || psc.ticketStage}</td>
                  <td>{psc.short_description || psc.shortDescription}</td>
                  <td>{psc.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-muted">
                  No matching records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );



  const renderForm = () => (
   <div className="card full-height">
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">Create PSC</h4>
        <form className='form-sample' onSubmit={handleSubmit}>
          <div className='form-row'>
            <div className='form-group col-md-2'>
              <label>Problem Number</label>
              <input className='form-control' 
              name='problem_number' 
              value={form.problem_number} 
              onChange={e => setForm({ ...form, [e.target.name]: e.target.value })} 
              placeholder='Problem Number' required readOnly />
            </div>
            <div className='form-group col-md-2'>
              <label>Initiator</label>
              <input className='form-control' name='initiator_name' value={form.initiator_name} onChange={e => setForm({ ...form, [e.target.name]: e.target.value })} placeholder='Initiator' required readOnly />
            </div>
            <div className='form-group col-md-2'>
              <label>Date</label>
              <input className='form-control' type='date' name='date' value={form.date} onChange={e => setForm({ ...form, [e.target.name]: e.target.value })} required />
            </div>
                <div className='form-group col-md-2'>
                  <label>Shift</label>
                  <select className='form-control' name='shift' value={form.shift} onChange={handleChange}>
                    <option value=''>-- Shift  --</option>
                    {masters.shifts.map(s => <option key={s.id || s.shift_name} value={s.id}>{s.shift_name || s.name || s.shift}</option>)}
                  </select>
                </div>
            <div className='form-group col-md-2'>
              <label>Value Stream</label>
                <select
                  className="form-control"
                  name="value_stream_line"
                  value={form.value_stream_line}
                  onChange={handleChange}
                >
                  <option value="">-- Value Stream --</option>
                  {masters.valuestreams.map(v => (
                    <option key={v.id} value={v.vl_code}>
                      {v.vl_name}
                    </option>
                  ))}
                </select>

            </div>
            <div className='form-group col-md-2'>
              <label>Line</label>   
                <select
                  className="form-control"
                    name="line_id"
                    value={form.line_id}
                  onChange={handleChange}
                >
                  <option value="">-- Line --</option>
                    {masters.lines
                      .filter(l => !form.value_stream_line || l.vl_code === form.value_stream_line)
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.line_name}
                        </option>
                      ))}
                </select>

            </div>
          </div>
          <div className='form-row'>
            
            <div className='form-group col-md-4'>
              <label>Short Description</label>
              <input className='form-control' 
              name='short_description' 
              value={form.short_description} 
              onChange={handleChange} placeholder='Short Description' /></div>
              <div className='form-group col-md-8'>
            <label>Problem Description</label>
            <textarea className='form-control' 
            name='problem_description' 
            value={form.problem_description} 
            onChange={handleChange} placeholder='Problem Description' /></div>
          
          </div>
          <div className='form-row'>
            <div className='form-group col-md-3'>
              <label>Qty Affected</label>
              <input className='form-control' name='qty_affected' value={form.qty_affected} onChange={handleChange} placeholder='Qty Affected' /></div>
            <div className='form-group col-md-3'>
              <label>Part Affected</label>
              <input className='form-control' name='part_affected' value={form.part_affected} onChange={handleChange} placeholder='Part Affected' /></div>
            <div className='form-group col-md-3'>
              <label>Supplier</label>
              <input className='form-control' name='supplier' value={form.supplier} onChange={handleChange} placeholder='Supplier' /></div>
            <div className='form-group col-md-3'>
              <label>Status</label>
              <input className='form-control' name='status' value={form.status} readOnly /></div>
          </div>
            <div className="fixed-card-footer text-right p-3 border-top bg-white">
            <button className='btn btn-secondary  mr-2' type='button' onClick={() => { setShowForm(false); setForm(emptyForm()); }}>Cancel</button>
            <button className='btn btn-primary' type='submit'>Create</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="container-fluid">
      {showForm ? renderForm() : showPreview ? renderPreview() : renderTable()}
    </div>
  );
}