// PSCList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PSCFullView from './PSCFullView';
import sendNotification from './shared/NavBar';
import toast, { Toaster } from "react-hot-toast";
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { FilterMatchMode } from 'primereact/api';
import { Tag } from 'primereact/tag';


export default function PSCList() {
  const [pscs, setPscs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selected, setSelected] = useState(null);
  const [masters, setMasters] = useState({ shifts: [], valuestreams: [], lines: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const emptyForm = () => ({
    problem_number: '', searchTerm: '', initiator_name: '', date: '', shift: '', value_stream_line: '',
    line_id: '', short_description: '', problem_description: '', qty_affected: '', problem_type: '',
    part_affected: '', supplier: '', status: 'Open'
  });
  const [filters, setFilters] = useState({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});
 const [globalFilterValue, setGlobalFilterValue] = useState('');
  // const sendNotification = (message) => {
  //   window.dispatchEvent(new CustomEvent("psc-notification", { detail: message }));
  // };
  // const sendNotification = (cardId, message) => {
  //   window.dispatchEvent(
  //     new CustomEvent("psc-notification", { detail: { cardId, message } })
  //   );
  // };
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [problemNumber, setProblemNumber] = useState('');


  const user = (() => {
    try { return JSON.parse(localStorage.getItem('dcmsUser')); }
    catch (e) { return null; }
  })();
  const userRespId = user?.user_resp_id || user?.userresp || null;

  useEffect(() => { fetchPscs(); fetchMasters(); }, []);
  useEffect(() => {
  // const fetchNextNumber = async () => {
  //   const res = await fetch('/psccard/next-number');
  //   const data = await res.json();
  //   setProblemNumber(data.problem_number);
  // };
  fetchNextNumber();
}, []);
const fetchNextNumber = async () => {
    const res = await fetch('/psccard/next-number');
    const data = await res.json();
    console.log("Next Problem Number:", data.problem_number);
    setProblemNumber(data.problem_number);
    return data.problem_number;
  };

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
    try {
      setLoading(true);
      console.log("Fetch Pscs userRespId :", userRespId);
      console.log("problemNumber :", problemNumber);
      // const res = await axios.get('/api/psc');
      const res = await axios.get('/api/psc', {
        params: { userRespId }
      });

      setPscs(res.data || []);
    } catch (err) {
      console.error('fetchPscs failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const generateProblemNumber = () => {
    // create PSC### based on existing count (simple client-side generation)
    const max = pscs.reduce((acc, p) => {
      const num = parseInt((p.problem_number || p.problemNumber || '').replace(/[^0-9]/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 100);
    console.log(max)
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        status: 'Open',
        ticket_stage: 'Plan',
        problem_number: problemNumber,
        initiator_name:
          form.initiator_name ||
          (user && (user.userName || user.username || user.name || user.usermail)) ||
          '',
        date: localDate,

      };

      await axios.post('/api/psc', payload);
      // generateProblemNumber()
      
      //sendNotification('Card Created:101');
      //sendNotification(`${form.problem_number}`);
     

      fetchPscs();
      fetchNextNumber();
      setForm(emptyForm());
      setShowForm(false);
      // window.location.reload();
       toast.success(`Record saved successfully :  ${problemNumber} created`, {
        position: 'top-right',
        autoClose: 3000,
      }
    );


    } catch (error) {
      console.error('Error saving PSC:', error);
      toast.error('❌ Failed to create PSC card');
    }
  };


  const openPreview = (psc) => { setSelected(psc); setShowPreview(true); setShowForm(false); };

  const openFormForCreate = async() => {
    const nextNumber = await fetchNextNumber();
    const user = (() => { try { return JSON.parse(localStorage.getItem('dcmsUser')); } catch (e) { return null; } })();
    setForm({
      ...emptyForm(),
      problem_number: nextNumber,
      initiator_name: user && (user.userName || user.username || user.name || user.usermail) || '',
      date: localDate,
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
const renderpsctable = () => {
  const sorted = [...filteredPSCs].sort((a, b) => {
    if (a.status === "Completed" && b.status !== "Completed") return 1;
    if (a.status !== "Completed" && b.status === "Completed") return -1;
    const aTime = new Date(a.updated_at || a.created_at || a.date || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || b.date || 0).getTime();
    return bTime - aTime;
  });

  // 2️⃣ Handle conditions BEFORE returning JSX
  if (loading) {
    return (
      <tr>
        <td colSpan="8" className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </td>
      </tr>
    );
  }

  if (!sorted || sorted.length === 0) {
    return (
      <tr>
        <td colSpan="8" className="text-center">No data available</td>
      </tr>
    );
  }

  // 3️⃣ Return mapping
  return sorted.map(psc => (
    <tr key={psc.id}>
      <td>
        <button
          className="btn btn-link p-0"
          onClick={() => openPreview(psc)}
        >
          {psc.problem_number || psc.problemNumber}
        </button>
      </td>
      <td>{psc.initiator_name || psc.initiatorName}</td>
      <td>{psc.date ? new Date(psc.date).toLocaleDateString('en-CA') : ''}</td>
      <td>{psc.shift_name}</td>
      <td>{psc.value_stream_line}</td>
      <td>{psc.short_description || psc.shortDescription}</td>
      <td>{psc.ticket_stage || psc.ticketStage}</td>
      <td>{psc.status}</td>
    </tr>
  ));
};

//   const renderTable = () => (
//     <div className="card mt-4 full-height">
//       <div className="card-body">
//         <div className="d-flex justify-content-between align-items-center mb-3">
//           <h4 className="card-title">Problem Solving Card List</h4>

//           <div className="d-flex align-items-center" style={{ gap: '10px', width: '40%' }}>
//             <input
//               type="text"
//               className="form-control"
//               placeholder="Search..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//             />
//             <button type="button" className="btn btn-primary" onClick={openFormForCreate}>
//               + PSC
//             </button>
//           </div>
//         </div>

//         {/* Table */}
//         <div className='table-responsive'>
//           <table className='table table-bordered table-hover'>
//             <thead className='thead-light'>
//               <tr style={{ fontSize: '14px' }}>
//                 <th>Problem No</th>
//                 <th>Initiator</th>
//                 <th>Date</th>
//                 <th>Shift</th>
//                 <th>Value Stream</th>
//                 <th>Short Description</th>
//                 <th>Stage</th>
//                 <th>Status</th>
//               </tr>
//             </thead>
//             <tbody>
//   {renderpsctable()}
// </tbody>

//           </table>
//         </div>
//       </div>
//     </div>
//   );

const onGlobalFilterChange = (e) => {
    const value = e.target.value;
    let _filters = { ...filters };
    _filters['global'].value = value;
    setFilters(_filters);
    setGlobalFilterValue(value);
  };
const getSeverity = (status) => {
    switch (status) {
      case 'Completed':
        return 'success';

      case 'For Validation':
        return 'info';

      case 'Work in Progress':
        return 'warning';

      case 'Open':
        return null;
    }
  };

  const statusBodyTemplate = (rowData) => {
    return (
      <Tag value={rowData.status} severity={getSeverity(rowData.status)} />
    );
  };

  const renderHeader = () => {
    return (
      <div className="flex align-items-center gap-2flex justify-content-end align-items-center gap-2 w-full">
        <IconField iconPosition="left">
          <InputIcon className="pi pi-search" />
          
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder="Keyword Search"
          />
        </IconField>
        <Button 
            label="+ PSC" 
            onClick={openFormForCreate} 
            className="p-button-primary"
          />
      </div>
    );
  };

  const header = renderHeader();

  const renderTable = () => (
  <div className="card mt-4 full-height">
    <div className="card-body">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="card-title">Problem Solving Card List</h4>

        {/* <div className="d-flex align-items-center" style={{ gap: '10px', width: '40%' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <Button 
            label="+ Add PSC" 
            onClick={openFormForCreate} 
            className="p-button-primary"
          />
        </div> */}
      </div>

      {/* PRIME DATA TABLE */}
      <DataTable 
        value={filteredPSCs} 
        paginator
        rows={10}
        sortMode="multiple"
        responsiveLayout="scroll"
        loading={filteredPSCs.length === 0}
        emptyMessage="No PSC records found"
        header={header}
        className="p-datatable-sm" 
         filters={filters} 
  globalFilterFields={[
    'problem_number',
    'initiator_name',
    'date',
    'shift_name',
    'vl_name',
    'ticket_stage',
    'short_description',
    'status'
  ]}

      >

        {/* Problem No with clickable button */}
        <Column style={{ minWidth: '9rem' }}
          header="Problem No" 
          field="problem_number"
          sortable
          body={(row) => (
            <Button 
              className="p-button-link p-0" 
              onClick={() => openPreview(row)}
              label={row.problem_number || row.problemNumber}
            />
          )}
        />

        {/* Other columns */}
        <Column  style={{ minWidth: '9rem' }}
          field="initiator_name" 
          header="Initiator" 
          sortable
          body={(row) => row.initiator_name || row.initiatorName}
        />

        <Column style={{ minWidth: '7rem' }}
          field="date" 
          header="Date" 
          sortable
          body={(row) => row.date ? new Date(row.date).toLocaleDateString('en-CA') : ''}
        />

        <Column style={{ minWidth: '7rem' }}
          header="Shift"
          sortable
          field='shift_name'
        />

        <Column style={{ minWidth: '8rem' }} field="vl_name" header="Value Stream" sortable />

       

        <Column style={{ minWidth: '12rem' }}
          field="short_description"
          header="Short Description"
          sortable
          body={(row) => row.short_description || row.shortDescription}
        />
         <Column style={{ minWidth: '6rem' }}
          field="ticket_stage" 
          header="Stage" 
          sortable
          body={(row) => row.ticket_stage || row.ticketStage}
        />

        <Column style={{ minWidth: '8rem' }}  body={statusBodyTemplate} field="status" header="Status" sortable />

      </DataTable>
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
                onChange={e => setProblemNumber({[e.target.name]: e.target.value })}
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
              <label>Value Stream <span style={{color:'red'}}>*</span></label>
              <select
                className="form-control"
                name="value_stream_line"
                value={form.value_stream_line}
                onChange={handleChange}
                required
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
              <label>Line<span style={{color:'red'}}>*</span></label>
              <select
                className="form-control"
                name="line_id"
                value={form.line_id}
                onChange={handleChange}
                required
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
              <label>Short Description <span style={{color:'red'}}>*</span></label>
              <input className='form-control'
                name='short_description'
                value={form.short_description}
                onChange={handleChange} placeholder='Short Description' required /></div>
            <div className='form-group col-md-8'>
              <label>Problem Description <span style={{color:'red'}}>*</span> </label>
              <textarea className='form-control'
                name='problem_description'
                value={form.problem_description}
                onChange={handleChange} placeholder='Problem Description' required /></div>
          </div>
          <div className='form-row'>
            <div className='form-group col-md-3'>
              <label>Problem Type</label>
              <select
                className='form-control'
                name='problem_type'
                value={form.problem_type}
                onChange={handleChange}
                required
              >
                <option value=''>-- Select KPI --</option>
                <option value='S'>Safety</option>
                <option value='Q'>Quality</option>
                <option value='D'>Delivery</option>
                <option value='C'>Cost</option>
                <option value='E'>Environment</option>
              </select>
            </div>
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
     <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
        }}
      />
      {showForm ? renderForm() : showPreview ? renderPreview() : renderTable()}

    </div>
  );
}