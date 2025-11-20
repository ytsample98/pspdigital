import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import PSCFullView from './PSCFullView';
import CommentDialog from './CommentDialog';
import { loadEscalations, computeEscalationForPsc } from './pscPermissions';
import { useCanEdit } from './canEdit';
import { Tabs, Tab } from 'react-bootstrap';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { FilterMatchMode } from 'primereact/api';
import { Tag } from 'primereact/tag';

// Small helper to create an empty CM row
const makeEmptyCm = (tempId = null) => ({
  id: null,
  tempId,
  description: '',
  targetDate: '',
  type: '',
  cm_status: 'Pending',
  comments:'',
  reasons:''
});
 


// Memoized input row to avoid remounts while typing
const CMInputRow = React.memo(function CMInputRow({ cm, onChange }) {
  const desc = cm?.description || '';
  const targetDate = cm?.targetDate || '';
  const type = cm?.type || '';

  return (
    <div className="mb-3">
      <div className="form-row">
        <div className="col-12">
          <label>Description</label>
          <textarea
            className="form-control"
            value={desc}
            onChange={(e) => onChange('description', e.target.value)}
            rows={3}
          />
        </div>
      </div>

      <div className="form-row mt-2">
        <div className="col-md-6">
          <label className="mt-2">Target Date</label>
          <input
            type="date"
            className="form-control"
            value={targetDate}
            onChange={(e) => onChange('targetDate', e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label className="mt-2">Type</label>
          <input className="form-control" readOnly value={type} />
        </div>
      </div>
    </div>
  );
});

/* -----------------------------
   TableView component (top-level)
   ----------------------------- */
function TableView({ filtered, searchTerm, setSearchTerm, handleSelect, loading }) {
  // Compute rows excluding status 'Open', sort Completed last and newest first
  const computed = React.useMemo(() => {
    const arr = (filtered || []).filter(p => (p.status || '').toString().toLowerCase() !== 'open').slice();
    arr.sort((a, b) => {
      if ((a.status || '').toString() === "Completed" && (b.status || '').toString() !== "Completed") return 1;
      if ((a.status || '').toString() !== "Completed" && (b.status || '').toString() === "Completed") return -1;
      const aTime = new Date(a.updated_at || a.created_at || a.date || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || b.date || 0).getTime();
      return bTime - aTime;
    });
    return arr;
  }, [filtered]);
  

  // // Keep the first post-load snapshot so we don't keep re-rendering/updating the table repeatedly
  const initialCapturedRef = React.useRef(null);
  React.useEffect(() => {
    if (!loading && initialCapturedRef.current === null) {
      initialCapturedRef.current = computed;
    }
  }, [loading, computed]);

  const rowsToRender = initialCapturedRef.current || (loading ? [] : computed);

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

  return (

  <div className="card mt-4 full-height">
    <div className="card-body">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="card-title">Root Cause Analysis</h4>

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
        value={rowsToRender} 
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
              onClick={() => handleSelect(row)}
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
  //         <h4 className="card-title">Root Cause Analysis</h4>
  //         <div style={{ width: '40%' }} className="d-flex">
  //           <input className="form-control" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
  //             ) : (!computed || computed.length === 0) ? (
  //               <tr>
  //                 <td colSpan="8" className="text-center">No data available</td>
  //               </tr>
  //             ) : (
  //               computed.map((psc) => (
  //                 <tr key={psc.id}>
  //                   <td>
  //                     <button className="btn btn-link p-0" onClick={() => handleSelect(psc)}>{psc.problemNumber || psc.problem_number}</button>
  //                   </td>
  //                   <td>{psc.initiatorName || psc.initiator_name}</td>
  //                   <td>{psc.date ? new Date(psc.date).toLocaleDateString('en-CA') : ''}</td>
  //                    <td>{psc.shift_name}</td>
  //                    <td>{psc.vl_name}</td>
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
}

/* -----------------------------
   PreviewView component (top-level)
   ----------------------------- */
function PreviewView({ selected, user, setShowPreview, setSelected, setShowForm, setActiveTab ,loadremHistory,remRemarks,refreshPsc}) {
  if (!selected) return null;
  const hasAcceptedCM = selected.root_cause?.countermeasures?.some(cm => cm.cm_status === 'Accepted');
  const canShowForm = !hasAcceptedCM;
  return (
    <PSCFullView
      // Pass only the id so PSCFullView will fetch the canonical full row from the backend for testing
      psc={selected ? { id: selected.id } : null}
      onClose={() => {
        setShowPreview(false);
        setSelected(null);
      }}
      actions={canShowForm ? (
        <div>
          <button
            className="btn btn-primary mr-2"
            onClick={async () => {
              // Ensure the latest saved data is loaded before opening the form
              try {
                await refreshPsc(selected.id);
              } catch (err) {
                console.warn('refresh before opening form failed', err);
              }
              setShowForm(true);
              setShowPreview(false);
              setActiveTab(selected.root_cause ? 'cm' : 'root');
              // load remarks/history after refresh
              try { await loadremHistory(); } catch (e) { /* ignore */ }
            }}
          >Add Root Cause</button>
        </div>
      ) : null}
    />
  );
}
 
const getCmKey = (cm, idx) => {
  if (cm.id) return `id-${cm.id}`;
  if (cm.tempId) return cm.tempId;
  return `temp-${idx}`; // changed from `idx-${idx}` to `temp-${idx}`
};


/* -----------------------------
   FormView component (top-level)
   ----------------------------- */
function FormView({
  selected,
  root,
  setShowForm,
  setShowPreview,
  activeTab,
  setActiveTab,
  handleChange,
  saveRootAndNext,
  countermeasures,
  latest,
  handleCountermeasureChange,
  saveCountermeasure,
  loadremHistory,
  remRemarks,
  uiState,
  handleActionToggle,
  handleRemarksChange,
  openCommentsDialog,
  badgeForStatus,
   showAddCm,     
  setShowAddCm,
    setRoot,     
  setUiState, 
  setText,      
  setRows      
}) {
  if (!selected) return null;
  const showRootTab = !selected.root_cause;

  // build rootTab and cmTab inline (hooks are allowed here if needed)
  const rootTab = (
    <Tab eventKey="root" title="Root Cause Analysis">
      <form onSubmit={saveRootAndNext}>
        <div className="form-group">
          <label>Symptom</label>
          <input name="symptom" value={root.symptom || ''} onChange={handleChange} className="form-control" />
        </div>

        <div className="form-row">
          {[1, 2, 3, 4, 5].map(i => (
            <div className="form-group col-md-4" key={i}>
              <label>Why {i} {i <= 3 && <span style={{ color: 'red' }}>*</span>}</label>
              <textarea name={`why${i}`} value={root[`why${i}`] || ''} onChange={handleChange} className="form-control" rows={4} />
            </div>
          ))}
        </div>

        <div className="form-group">
          <label>Final Cause <span style={{ color: 'red' }}>*</span></label>
          <textarea name="finalCause" value={root.finalCause || ''} onChange={handleChange} className="form-control" rows={3} required />
        </div>

        <div className="fixed-card-footer text-right p-3 border-top bg-white">
          <button type="button" className="btn btn-primary ml-2" onClick={saveRootAndNext}>Save Root Cause & Next</button>
        </div>
      </form>
    </Tab>
  );

 

  const cmTab = (
    
    <Tab eventKey="cm" title="Countermeasure & Effect Check">
     {(showAddCm)  && (
        console.log('Rendering Add Countermeasure section', latest,showAddCm),
  <> 
      <h5><b>Countermeasure History</b></h5>

      <h5><b>Add Countermeasure</b></h5>
      <CMInputRow cm={latest} onChange={handleCountermeasureChange} />
        </>
)}
      <div className="mt-3">
        <button type="button" className="btn btn-primary" onClick={() => {saveCountermeasure(); }}>Save Countermeasure</button>
      </div>

      <div className="table-responsive mb-3 mt-3">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Description</th>
              <th>Target Date</th>
              <th>Type</th>
              <th>Status</th>
              {/* <th>Comments</th> */}
              <th>Action</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {(countermeasures.filter(cm => cm.id).length) ? (
              countermeasures.filter(cm => cm.id).map((cm, idx) => {
                // const cmKey = cm.id ? `id-${cm.id}` : (cm.tempId || `idx-${idx}`);
                  // const cmKey = getCmKey(cm, idx);  
                  const cmKey = getCmKey(cm, idx);
                 console.log(`Rendering CM row: index=${idx}, cmKey=${cmKey}`, cm, uiState[cmKey]);
                return (
                  <tr key={cmKey}>
                    <td>{cm.description}</td>
                    <td>{cm.targetDate}</td>
                    <td>{cm.type}</td>
                    <td>{badgeForStatus(cm.cm_status)}</td>
                    {/* <td>
                      <button type="button" className="btn btn-link p-0" onClick={() => openCommentsDialog(cm)}>Comments</button>
                    </td> */}
                    <td>
                      <input type="checkbox" checked={uiState[cmKey]?.actionTaken || false} onChange={(e) => handleActionToggle(cmKey, e.target.checked)} />
                    </td>
                    <td>
                      {uiState[cmKey]?.showRemarks ? (
                        <input type="text" className="form-control" value={uiState[cmKey]?.remarks || ''} onChange={(e) => handleRemarksChange(cmKey, e.target.value)} placeholder="Enter remarks" />
                      ) : null}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="text-center">No countermeasures yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

       <div className="mb-3">
          <label>Comments</label>
          <textarea
            className="form-control"
            value={latest.comments || ''}
            rows={3} readOnly style={{ minHeight: '100px', maxHeight: '300px' }}
          />
        </div>

        <div className="mb-3">
          <label>Remarks from effectiveness check</label>
          <textarea
            className="form-control"
            value={remRemarks.map(r => r.reasons).join("\n")}
            rows={3} readOnly style={{ minHeight: '100px', maxHeight: '300px' }}
          />
        </div>
    </Tab>
  );

  return (
    <div className="card full-height">
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4>PSC: {selected.problem_number || selected.problemNumber}</h4>
            <div className="mb-2"><strong>Short Desc:</strong> {selected.short_description || selected.shortDescription}</div>
          </div>

          <button type="button" className="btn btn-danger" onClick={() => { setShowForm(false); setShowPreview(false);  
    //       setRoot({
    //   symptom: '',
    //   finalCause: '',
    //   why1: '',
    //   why2: '',
    //   why3: '',
    //   why4: '',
    //   why5: '',
    //   countermeasures: [makeEmptyCm('temp-0')]
    // });
    // setUiState({});
    // setShowAddCm(false);
    // setText('');
    // setRows([]);
    }}>Exit</button>
        </div>

        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
          {showRootTab && rootTab}
          {cmTab}
        </Tabs>
      </div>
    </div>
  );
}

/* -----------------------------
   RootCause (main) component
   ----------------------------- */
export default function RootCause() {
  // --- all the state & handlers (kept same as your last uploaded file) ---


  const [pscs, setPscs] = useState([]);
  const [text, setText] = useState('');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [uiState, setUiState] = useState({});
  const [showAddCm, setShowAddCm] = useState(false);
  const [root, setRoot] = useState({
    symptom: '',
    finalCause: '',
    why1: '',
    why2: '',
    why3: '',
    why4: '',
    why5: '',
    countermeasures: [makeEmptyCm('temp-0')]
  });
  const [form, setForm] = useState({ description: '', date: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [reassign, setReassign] = useState({ remarks: '', assignTo: '' });
  const [showReassignSimple, setShowReassignSimple] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const canEdit = useCanEdit(selected, activeEsc);
  const [activeTab, setActiveTab] = useState('root');
  const [showCommentsDialog, setShowCommentsDialog] = useState(false);
  const [selectedCMForComments, setSelectedCMForComments] = useState(null);
  const [cmHistory, setCmHistory] = useState([]);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dcmsUser') || 'null'); } catch (e) { return null; }
  });

  // Reuse handlers from uploaded file (kept identical)
  useEffect(() => {
    fetchPscs();
    loadEscalations().then(list => setEscalations(list));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) refreshPsc(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Automatically show Add Countermeasure section if latest CM has empty comments
useEffect(() => {
  const countermeasures = root.countermeasures || [];
  const lastIdx = countermeasures.length ? countermeasures.length - 1 : 0;
  const latest = countermeasures[lastIdx] || makeEmptyCm('temp-0');

  if (!latest.comments || latest.comments.trim() === '') {
    setShowAddCm(true);
  } else {
    setShowAddCm(false);
  }
}, [root.countermeasures]);


  const fetchPscs = useCallback(async () => {
    setLoading(true);
    try {
      // const res = await axios.get('/api/psc');
      const user = (() => {
            try { return JSON.parse(localStorage.getItem('dcmsUser')); }
            catch (e) { return null; }
          })();
          const userRespId = user?.user_resp_id || user?.userresp || null;
          console.log("Fetch Pscs userRespId :", userRespId);
          const res = await axios.get('/api/psc', {
            params: { userRespId }
          });
      setPscs(res.data || []);
    } catch (e) {
      console.warn('fetch pscs failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

   const fetchDepartments = useCallback(async () => {
      try {
        const res = await axios.get('/api/department');
        setDepartments(res.data || []);
      } catch (e) {
        console.warn('dept load failed', e);
      }
    }, []);

  const refreshPsc = useCallback(async (pscId) => {
    try {
      const res = await axios.get(`/api/psc/${pscId}`);
      if (!res.data) return;
      const joined = res.data;
      if (joined.root_cause) {
        const rc = joined.root_cause;
        const cmsFromApi = (rc.countermeasures || []).map((cm, i) => ({
          id: cm.id,
          tempId: cm.id ? null : `temp-api-${i}-${Date.now()}`,
          description: cm.description || cm.countermeasure || '',
          targetDate: cm.targetDate || cm.target_date || '',
          type: cm.type || '',
          cm_status: cm.cm_status || cm.status || 'Pending',
          createdBy: cm.createdBy || cm.created_by || null,
          createdAt: cm.createdAt || cm.created_at || null,
          comments: cm.comments ||  ''
        }));

        setRoot({
          symptom: rc.symptom || '',
          finalCause: rc.final_cause || '',
          why1: rc.why1 || '',
          why2: rc.why2 || '',
          why3: rc.why3 || '',
          why4: rc.why4 || '',
          why5: rc.why5 || '',
          countermeasures: cmsFromApi.length ? cmsFromApi : [makeEmptyCm('temp-0')]
        });

const rebuiltUi = {};
(cmsFromApi.length ? cmsFromApi : [makeEmptyCm('temp-0')]).forEach((cm, idx) => {
  const cmKey = getCmKey(cm, idx);
  rebuiltUi[cmKey] = {
    actionTaken: false,
    showRemarks: false,
    remarks: cm.remarks || ""  // <-- include existing remarks if any
  };
});
setUiState(rebuiltUi);



        setActiveTab('cm');
      } else {
        setRoot(prev => ({ ...prev, countermeasures: prev.countermeasures && prev.countermeasures.length ? prev.countermeasures : [makeEmptyCm('temp-0')] }));
        setActiveTab('root');
      }
    } catch (err) {
      console.warn('refreshPsc failed', err);
    }
  }, []);

  const handleSelect = useCallback((psc) => {
    setSelected(psc);
    setShowPreview(true);
    setShowForm(false);
    if (!escalations.length) {
      loadEscalations().then(list => {
        setEscalations(list);
        setActiveEsc(computeEscalationForPsc(psc, list));
      });
    } else {
      setActiveEsc(computeEscalationForPsc(psc, escalations));
    }
  }, [escalations]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setRoot(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleCountermeasureChange = useCallback((field, value) => {
    setRoot(prev => {
      const cms = Array.isArray(prev.countermeasures) ? [...prev.countermeasures] : [];
      if (!cms.length) cms.push(makeEmptyCm('temp-0'));
      const idx = cms.length - 1;
      const last = { ...(cms[idx] || makeEmptyCm(`temp-${Date.now()}`)) };
      last[field] = value;

      if (field === 'targetDate') {
        try {
          const diff = (new Date(value) - new Date()) / (1000 * 60 * 60 * 24);
          last.type = diff > 7 ? 'Long term corrective action' : 'Short term corrective action';
        } catch (err) {
          last.type = '';
        }
      }

      cms[idx] = last;
      return { ...prev, countermeasures: cms };
    });
  }, []);

  const saveRootAndNext = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selected) return;

    const userId = user?.id || null;
    const cmsToSend = (root.countermeasures || []).filter(cm => (cm.description || '').toString().trim()).map(cm => ({
      description: cm.description,
      targetDate: cm.targetDate,
      type: cm.type,
      created_by: userId
    }));

    const payload = {
      why1: root.why1,
      why2: root.why2,
      why3: root.why3,
      why4: root.why4,
      why5: root.why5,
      final_cause: root.finalCause,
      symptom: root.symptom,
      filled_by: userId,
      countermeasures: cmsToSend
    };

    try {
      await axios.put(`/api/psc/${selected.id}/rootcause`, payload);
      await refreshPsc(selected.id);
      setActiveTab('cm');
    } catch (err) {
      console.error('saveRootAndNext failed', err);
      alert('Failed to save root cause. See console.');
    }
  }, [root, selected, user, refreshPsc]);
 const [remRemarks, setremHistory] = useState([]);

const loadremHistory = useCallback(async () => {
  const res = await axios.get(`/api/psc/${selected.id}/countremark`);
   setremHistory(res.data);

  const reasonsText = res.data
    .map(r => r.reasons)        // NOT r.res.data[0].reasons
    .filter(Boolean)
    .join("\n");
});
   

  const saveCountermeasure = useCallback(async () => {
    if (!selected) return;
    const cms = root.countermeasures || [];

  //Filter out empty countermeasures
  const cmsToSave = cms.filter(cm => (cm.description || '').trim());

  if (!cmsToSave.length) return alert('Please enter at least one Countermeasure.');
  const userRespId = user?.user_resp_id || user?.userresp || null;
   const payloads = cmsToSave.map((cm, idx) => ({
    description: cm.description,
    targetDate: cm.targetDate,
    type: cm.type || '',
    comments: cm.remarks || '', // <-- now remarks are saved correctly
    created_by: user?.id || null,
    userRespId:userRespId
  }));
  console.log('Saving countermeasures:', payloads);
  const newEntry = (root.countermeasures || [])
  .filter(cm => (cm.description || '').trim()) // ignore empty
  .map(cm => ({
    description: cm.description,
    targetDate: cm.targetDate,
    type: cm.type,
    remarks: cm.remarks || ''
    
  }));

    try {
       const savedCms = [];
       for (const payload of payloads) {
      const res = await axios.post(`/api/psc/${selected.id}/countermeasure`, payload);
      console.log(res.data)
      savedCms.push(res.data);// capture saved countermeasure with latest comments
    }
      await refreshPsc(selected.id);
      setText('');
      setRows(prev => [...prev, newEntry]);
      // setRoot(prev => {
      //   const updated = (prev.countermeasures || []).map(c => ({ ...c }));
      //   const lastAfter = updated[updated.length - 1] || {};
      //   if (lastAfter && (lastAfter.description || '').toString().trim()) {
      //     updated.push(makeEmptyCm(`temp-${Date.now()}`));
      //   }
      //   return { ...prev, countermeasures: updated };
      // });

      setRoot(prev => {
          const updated = (prev.countermeasures || []).map((c, idx) => ({
            ...c,
            comments: savedCms[idx]?.comments || c.comments || ''
          }));
          const lastAfter = updated[updated.length - 1] || {};
          if (lastAfter && (lastAfter.description || '').trim()) {
            updated.push(makeEmptyCm(`temp-${Date.now()}`));
          }
          return { ...prev, countermeasures: updated };
      });
      //  setLatest(savedCms[savedCms.length - 1] || latest);
      // Hide the add countermeasure section
      // if (savedCms[savedCms.length - 1]?.comments?.trim()) {
        setShowAddCm(false);
      // }
    } catch (err) {
      console.error('saveCountermeasure failed', err);
      alert('Failed to save countermeasure. See console.');
    }
  }, [root, selected, user, refreshPsc]);

  const openCommentsDialog = useCallback(async (cm) => {
    if (!cm) return;
    if (!cm.id) {
      alert('Please save this Countermeasure before adding comments.');
      return;
    }

    try {
      const res = await axios.get(`/api/countermeasure/${cm.id}/history`);
      setSelectedCMForComments(cm);
      setCmHistory((res.data || []).map(h => ({
        id: h.id,
        type: h.type,
        text: h.text,
        logged_by: h.logged_by,
        logged_by_name: h.logged_by_name,
        timestamp: h.timestamp
      })));
      setShowCommentsDialog(true);
    } catch (err) {
      console.error('openCommentsDialog failed', err);
      setSelectedCMForComments(cm);
      setCmHistory([]);
      setShowCommentsDialog(true);
    }
  }, []);

  const submitCommentForSelectedCM = useCallback(async (commentText) => {
    if (!selectedCMForComments || !selectedCMForComments.id) return alert('Save the countermeasure first.');
    try {
      await axios.post(`/api/countermeasure/${selectedCMForComments.id}/comment`, {
        comment: commentText,
        logged_by: user?.id || null
      });
      await refreshPsc(selected.id);
      setShowCommentsDialog(false);
      setSelectedCMForComments(null);
      setCmHistory([]);
    } catch (err) {
      console.error('submitComment failed', err);
      alert('Failed to submit comment.');
    }
  }, [selectedCMForComments, selected, user, refreshPsc]);

  const badgeForStatus = useCallback((status) => {
    const s = (status || '').toLowerCase();
    const className =
      s === 'accepted' ? 'badge badge-success' :
        s === 'for validation' ? 'badge badge-warning' :
          s === 'rejected' ? 'badge badge-danger' :
            'badge badge-secondary';
    return <span className={className}>{status || 'Pending'}</span>;
  }, []);

  const removeCountermeasureRow = useCallback((index) => {
    setRoot(prev => {
      const cms = (prev.countermeasures || []).map((c) => ({ ...c }));
      cms.splice(index, 1);
      return { ...prev, countermeasures: cms.length ? cms : [makeEmptyCm(`temp-${Date.now()}`)] };
    });
  }, []);

  const handleReassignChange = useCallback((e) => {
    const { name, value } = e.target;
    setReassign(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'targetDate') {
        try {
          const diff = (new Date(value) - new Date()) / (1000 * 60 * 60 * 24);
          next.type = diff > 7 ? 'Long term corrective action' : 'Short term corrective action';
        } catch (err) {
          next.type = '';
        }
      }
      return next;
    });
  }, []);

  const submitReassign = useCallback(async () => {
    if (!selected) return;
    try {
      const payload = { corrective_action: reassign, status: 'Work in Progress', ticket_stage: 'Do' };
      await axios.put(`/api/psc/${selected.id}`, payload);
      setReassign({ countMeasure: '', targetDate: '', type: '', remarks: '', assignTo: '' });
      setShowPreview(false);
      setSelected(null);
      fetchPscs();
    } catch (err) {
      console.error('submit reassign failed', err);
    }
  }, [reassign, selected, fetchPscs]);

  const filtered = useMemo(() => pscs.filter((p) => {
    const s = (searchTerm || '').toLowerCase();
    const maybe = (v) => (v || '').toString().toLowerCase();
    return (
      maybe(p.problem_number || p.problemNumber).includes(s) ||
      maybe(p.initiator_name || p.initiatorName).includes(s) ||
      maybe(p.date).includes(s) ||
      maybe(p.shift).includes(s) ||
      maybe(p.value_stream_line || p.valueStreamLine || p.valueStream || p.value_stream).includes(s) ||
      maybe(p.ticket_stage || p.ticketStage).includes(s) ||
      maybe(p.short_description || p.shortDescription).includes(s) ||
      maybe(p.status).includes(s)
    );
  }), [pscs, searchTerm]);

  const handleActionToggle = useCallback((id, isChecked) => {
      console.log(`handleActionToggle: cmKey=${id}, checked=${isChecked}`);
    setUiState(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        actionTaken: isChecked,
        showRemarks: isChecked,
        remarks: isChecked ? (prev[id]?.remarks || "") : ""
      }
    }));
  }, []);

  const handleRemarksChange = useCallback((cmKey, value) => {
  // Update uiState
  setUiState(prev => {
    const next = {
      ...prev,
      [cmKey]: {
        ...(prev[cmKey] || {}),
        remarks: value
      }
    };
    console.log('Updated uiState:', next); // ✅ Log uiState after change
    return next;
  });

  // Also update the countermeasure object itself
  setRoot(prev => {
    const updatedCms = prev.countermeasures.map((cm, idx) => {
      if (getCmKey(cm, idx) === cmKey) {
        console.log(`Updating CM object for cmKey=${cmKey}:`, { ...cm, remarks: value }); // ✅ Log CM being updated
        return { ...cm, remarks: value }; // store remarks directly in cm
      }
      return cm;
    });
    return { ...prev, countermeasures: updatedCms };
  });
}, []);



  // render
  const countermeasures = root.countermeasures || [];
  // const lastIdx = countermeasures.length ? countermeasures.length - 1 : 0;
  // const latest = countermeasures[lastIdx] || makeEmptyCm('temp-0');
  const latest = countermeasures.slice().reverse().find(cm => (cm.description || '').trim()) || makeEmptyCm('temp-0');
 

  return (
    <div>
      {!showPreview && !showForm && (
        <TableView filtered={filtered} searchTerm={searchTerm} setSearchTerm={setSearchTerm} handleSelect={handleSelect} loading={loading} />
      )}
      {showPreview && (
        <PreviewView selected={selected} user={user} setShowPreview={setShowPreview} setSelected={setSelected} setShowForm={setShowForm} setActiveTab={setActiveTab}  loadremHistory={loadremHistory}  remRemarks={remRemarks}/>
      )}
      {showForm && (
        <FormView
          selected={selected}
          root={root}
          setShowForm={setShowForm}
          setShowPreview={setShowPreview}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleChange={handleChange}
          saveRootAndNext={saveRootAndNext}
          countermeasures={countermeasures}
          latest={latest}
          handleCountermeasureChange={handleCountermeasureChange}
          saveCountermeasure={saveCountermeasure}
          loadremHistory={loadremHistory}
          remRemarks={remRemarks}
          uiState={uiState}
          handleActionToggle={handleActionToggle}
          handleRemarksChange={handleRemarksChange}
          openCommentsDialog={openCommentsDialog}
          badgeForStatus={badgeForStatus}
          showAddCm={showAddCm}               // ✅ pass it here
    setShowAddCm={setShowAddCm}  
    setRoot={setRoot}
  setUiState={setUiState}
  setText={setText}
  setRows={setRows}
        />
      )}

      <CommentDialog
        show={showCommentsDialog}
        onClose={() => { setShowCommentsDialog(false); setSelectedCMForComments(null); setCmHistory([]); }}
        cm={selectedCMForComments}
        history={cmHistory}
        onSubmitComment={submitCommentForSelectedCM}
      />
    </div>
  );
}