// CorrectiveAction.js
import React, { useState, useEffect, useCallback,useMemo } from 'react';
import axios from 'axios';
import PSCFullView from './PSCFullView';
import { loadEscalations, computeEscalationForPsc } from './pscPermissions';
import toast, { Toaster } from "react-hot-toast";
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { FilterMatchMode } from 'primereact/api';
import { Tag } from 'primereact/tag';

export default function CorrectiveAction() {
  const [pscs, setPscs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState({
    initialContainmentAction: '',
    doneBy: '',
    assignTo: '',
    targetDate: '',
    remarks: ''
  });
  const [departments, setDepartments] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);

  // Fetch PSCs, Departments, Escalations
  useEffect(() => {
    fetchPscs();
    fetchDepartments();
    loadEscalations().then(list => setEscalations(list));
    try {
      const op = localStorage.getItem('openPsc');
      if (op) {
        const p = JSON.parse(op);
        setSelected(p);
        setShowPreview(true);
        localStorage.removeItem('openPsc');
      }
    } catch (e) { }
  }, []);


  const fetchPscs = async () => {
    setLoading(true);
    try {
      const user = (() => {
        try { return JSON.parse(localStorage.getItem('dcmsUser')); }
        catch (e) { return null; }
      })();
      const userRespId = user?.user_resp_id || user?.userresp || null;
      console.log("Fetch Pscs userRespId :", userRespId);
      const res = await axios.get('/api/psc', {
        params: { userRespId }
      });
      // const res = await axios.get('/api/psc');
      setPscs(res.data || []);
    } catch (err) {
      console.error('fetchPscs failed', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get('/api/department');
      setDepartments(res.data || []);
    } catch (e) {
      console.warn('dept load failed', e);
    }
  };
  

  const handleSelect = useCallback((psc) => {
    setSelected(psc);
    setShowPreview(true);
    setShowForm(false);

    const user = (() => {
      try {
        return JSON.parse(localStorage.getItem('dcmsUser'));
      } catch (e) {
        return null;
      }
    })();

    const existing = psc && (psc.action_taken || psc.corrective_action || {});
    const doneByName = (user && (user.userName || user.username || user.name || user.usermail)) || '';

    setAction(prev => ({
      ...prev,
      initialContainmentAction: existing.initialContainmentAction || existing.action_taken || prev.initialContainmentAction,
      doneBy: existing.doneBy || existing.done_by || doneByName,
      assignTo: existing.assignTo || existing.corrective_assign_to || prev.assignTo,
      targetDate: existing.targetDate || existing.corrective_target_date || prev.targetDate,
      remarks: existing.remarks || existing.corrective_comments || prev.remarks
    }));
  }, []);

  useEffect(() => {
    if (selected && escalations.length) {
      const esc = computeEscalationForPsc(selected, escalations);
      setActiveEsc(esc);
    } else {
      setActiveEsc(null);
    }
  }, [selected, escalations]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setAction(prev => ({ ...prev, [name]: value }));
  }, []);


  const user = (() => {
    try { return JSON.parse(localStorage.getItem('dcmsUser')); }
    catch (e) { return null; }
  })();
  const userRespId = user?.user_resp_id || user?.userresp || null;
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!selected) return;
    const user = (() => {
      try {
        return JSON.parse(localStorage.getItem('dcmsUser'));
      } catch (e) {
        return null;
      }
    })();

    const toSend = { ...action };
    if (!toSend.doneBy)
      toSend.doneBy = (user && (user.userName || user.username || user.name || user.usermail)) || '';

    const payload = {
      action_taken: toSend.initialContainmentAction || '',
      done_by: user?.id || null,
      corrective_assign_to: Number(toSend.assignTo) || null,
      corrective_comments: toSend.remarks || '',
      userRespId: userRespId
    };

    console.log('Sending payload:', payload);
    await axios.put(`/api/psc/${selected.id}/corrective`, payload);
    toast.success(`Containment Action for ${selected.problem_number} saved successfully.`, {
        position: 'top-right',
        autoClose: 3000,
    });
    setAction({
      initialContainmentAction: '',
      doneBy: '',
      assignTo: '',
      targetDate: '',
      remarks: ''
    });
fetchPscs();
    setSelected(null);
    setShowForm(false);
    setShowPreview(false);
    



  }, [action, selected]);

  // const filteredPSCs = pscs.filter(p => {
  //   const s = searchTerm.toLowerCase();
  //   return (
  //     (p.problem_number || p.problemNumber || '').toLowerCase().includes(s) ||
  //     (p.initiator_name || p.initiatorName || '').toLowerCase().includes(s) ||
  //     (p.date || '').toLowerCase().includes(s) ||
  //     (p.shift || '').toLowerCase().includes(s) ||
  //     (p.value_stream_line || p.valueStreamLine || '').toLowerCase().includes(s) ||
  //     (p.ticket_stage || p.ticketStage || '').toLowerCase().includes(s) ||
  //     (p.short_description || p.shortDescription || '').toLowerCase().includes(s) ||
  //     (p.status || '').toLowerCase().includes(s)
  //   );
  // });
    const filteredPSCs = useMemo(() => pscs.filter((p) => {
      const s = (searchTerm || '').toLowerCase();
      const maybe = (v) => (v || '').toString().toLowerCase();
      return (
        maybe(p.problem_number || p.problemNumber).includes(s) ||
        maybe(p.initiator_name || p.initiatorName).includes(s) ||
        maybe(p.date).includes(s) ||
        maybe(p.shift).includes(s) ||
        maybe(p.value_stream_line || p.valueStreamLine || p.valueStream || p.value_stream).includes(s) ||
        maybe(p.ticket_stage || p.ticketStage).includes(s) ||
        maybe(p.status).includes(s)
      );
    }), [pscs, searchTerm]);

  return (
    <div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
        }}
      />
      {!showPreview && !showForm && (
        <TableView
          filteredPSCs={filteredPSCs}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          openPreview={handleSelect}
          loading={loading}
        />
      )}

      {showPreview && (
        <PreviewView
          selected={selected}
          setShowForm={setShowForm}
          setShowPreview={setShowPreview}
          setSelected={setSelected}
        />
      )}

      {showForm && (
        <FormView
          selected={selected}
          action={action}
          departments={departments}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          setShowForm={setShowForm}
          setShowPreview={setShowPreview}
        />
      )}
    </div>
  );
}

// ============= Sub Components =============

const TableView = React.memo(({ filteredPSCs, searchTerm, setSearchTerm, openPreview, loading }) => {
  const sorted = React.useMemo(() => {
    const arr = (filteredPSCs || []).slice();
    arr.sort((a, b) => {
      if (a.status === "Completed" && b.status !== "Completed") return 1;
      if (a.status !== "Completed" && b.status === "Completed") return -1;
      const aTime = new Date(a.updated_at || a.created_at || a.date || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || b.date || 0).getTime();
      return bTime - aTime;
    });
    return arr;
  }, [filteredPSCs]);
    // const initialCapturedRef = React.useRef(null);
    // React.useEffect(() => {
    //   if (!loading && initialCapturedRef.current === null) {
    //     initialCapturedRef.current = sorted;
    //   }
    // }, [loading, sorted]);
  
    // const rowsToRender = initialCapturedRef.current || (loading ? [] : sorted);

 const rowsToRender = sorted;


      
      const [filters, setFilters] = useState({
      global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    });
     const [globalFilterValue, setGlobalFilterValue] = useState('');
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
          <div className="flex justify-content-end">
            
            <IconField iconPosition="left">
              <InputIcon className="pi pi-search" />
              <InputText
                value={globalFilterValue}
                onChange={onGlobalFilterChange}
                placeholder="Keyword Search"
              />
            </IconField>
          </div>
        );
      };
    
      const header = renderHeader();

      const sortedRows = [...rowsToRender].sort((a, b) => new Date(b.id) - new Date(a.id));
    
      return (
    
      <div className="card mt-4 full-height">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="card-title">Containment Action</h4>
    
            {/* <div className="d-flex align-items-center" style={{ gap: '10px', width: '40%' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
    
            </div> */}
          </div>
    
          {/* PRIME DATA TABLE */}
          <DataTable 
            // value={rowsToRender} 
            value={sortedRows}
            paginator
            rows={10}
            sortMode="multiple"
            responsiveLayout="scroll"
            // loading={rowsToRender.length === 0}
             loading={loading}
            emptyMessage="No PSC records found"
            header={header}
            className="p-datatable-sm" 
             filters={filters} 
      globalFilterFields={[
        'problem_number',
        'initiator_name',
        'date',
        'shift_name',
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
              body={(row) => row.shift_name}
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
    

  // return (
  //   <div className="card mt-4 full-height">
  //     <div className="card-body">
  //       <div className="d-flex justify-content-between align-items-center mb-3">
  //         <h4 className="card-title">Containment Action</h4>
  //         <div style={{ width: '40%' }} className="d-flex">
  //           <input
  //             className="form-control"
  //             placeholder="Search..."
  //             value={searchTerm}
  //             onChange={e => setSearchTerm(e.target.value)}
  //           />
  //         </div>
  //       </div>

  //       <div className="table-responsive">
  //         <table className="table table-bordered table-hover">
  //           <thead className="thead-light">
  //             <tr>
  //               <th>Problem No</th>
  //               <th>Initiator</th>
  //               <th>Date</th>
  //               <th>Shift</th>
  //               <th>Value Stream</th>
  //               <th>Short Description</th>
  //               <th>Stage</th>
  //               <th>Status</th>
  //             </tr>
  //           </thead>
  //           <tbody>
  //             {loading ? (
  //               <tr>
  //                 <td colSpan="8" className="text-center">
  //                   <div className="spinner-border text-primary" role="status">
  //                     <span className="sr-only">Loading...</span>
  //                   </div>
  //                 </td>
  //               </tr>
  //             ) : (!sorted || sorted.length === 0) ? (
  //               <tr>
  //                 <td colSpan="8" className="text-center">No data available</td>
  //               </tr>
  //             ) : (
  //               sorted.map(psc => (
  //                 <tr key={psc.id}>
  //                   <td>
  //                     <button className="btn btn-link p-0" onClick={() => openPreview(psc)}>
  //                       {psc.problemNumber || psc.problem_number}
  //                     </button>
  //                   </td>
  //                   <td>{psc.initiatorName || psc.initiator_name}</td>
  //                   <td>{psc.date ? new Date(psc.date).toLocaleDateString('en-CA') : ''}</td>
  //                    <td>{psc.shift_name}</td>
  //                   <td>{psc.vl_name}</td>
  //                   <td>{psc.shortDescription || psc.short_description}</td>
  //                   <td>{psc.ticketStage || psc.ticket_stage}</td>
  //                   <td>{psc.status}</td>
  //                 </tr>
  //               ))
  //             )}
  //           </tbody>
  //         </table>
  //       </div>
  //     </div>
  //   </div>
  // );
});

const PreviewView = React.memo(({ selected, setShowForm, setShowPreview, setSelected }) => {
  if (!selected) return null;
  const stage = (selected.ticket_stage || selected.ticketStage || '');
  const canShowForm = stage === 'Plan';
  return (
    <PSCFullView
      psc={selected}
      onClose={() => {
        setShowPreview(false);
        setSelected(null);
      }}
      actions={
        canShowForm ? (
          <div>
            <button
              className="btn btn-primary mr-2"
              onClick={() => {
                setShowForm(true);
                setShowPreview(false);
              }}
            >
              Add Containment Action
            </button>
          </div>
        ) : null
      }
    />
  );
});

const FormView = React.memo(
  
  ({ selected, action, departments, handleChange, handleSubmit, setShowForm, setShowPreview }) => {
     
    if (!selected) return null;
    
    return (
      <div className="card full-height">
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <h4>PSC: {selected.problem_number}</h4>
          <div className="mb-2">
            <strong>Short Desc:</strong> {selected.short_description}
          </div>
          <div className="form-group">
            <label>Containment Action</label>
            <textarea
              className="form-control"
              style={{ height: '120px', resize: 'vertical' }}
              name="initialContainmentAction"
              value={action.initialContainmentAction}
              onChange={handleChange}
              placeholder="Containment Action"
            />
          </div>

          <div className="form-row">
            <div className="form-group col-md-4">
              <label>Done By</label>
              <input
                className="form-control"
                name="doneBy"
                value={action.doneBy}
                onChange={handleChange}
                readOnly
              />
            </div>

            <div className="form-group col-md-4">
              <label>Assign To</label>
              <select
                className="form-control"
                name="assignTo"
                value={action.assignTo}
                onChange={handleChange}
                required
              >
                <option value="">-- Select Dept --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.dept_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Remarks</label>
            <input
              name="remarks"
              value={action.remarks}
              onChange={handleChange}
              className="form-control"
              placeholder="Remarks"
            />
          </div>
        </div>

        <div className="fixed-card-footer text-right p-3 border-top bg-white">
          <button
            type="button"
            className="btn btn-secondary mr-2"
            onClick={() => {
              setShowForm(false);
              setShowPreview(true);
            }}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} >
            Save Containment Action
          </button>
        </div>
      </div>
    );
  }
);
