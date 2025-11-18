import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import CountermeasureComments from './CountermeasureComments';
import { loadEscalations, computeEscalationForPsc } from './pscPermissions';
import { useCanEdit } from './canEdit';
import PSCFullView from './PSCFullView';

// Confirm modal component defined at module scope to remain stable across renders
const ConfirmModal = React.memo(function ConfirmModal({ show, confirmMode, initialRemark, onClose, onSave }) {
  const [localRemark, setLocalRemark] = useState(initialRemark || '');
  useEffect(() => { setLocalRemark(initialRemark || ''); }, [initialRemark]);
  if (!show) return null;
  return (
    <div
      className="modal show"
      style={{
        display: 'block',
        backgroundColor: 'rgba(0,0,0,0.4)',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1050
      }}
    >
      <div className="modal-dialog" style={{ marginTop: '10%' }}>
        <div className="modal-content">
          <div className="modal-header">
            <b>{confirmMode === "accept" ? "Accept" : "Reject"} Selected Countermeasures</b>
            <button type='button' className="close" onClick={() => { onClose(); }}>
              &times;
            </button>
          </div>
          <div className="modal-body">
            <textarea
              rows={4}
              className="form-control"
              placeholder="Remark..."
              value={localRemark}
              onChange={e => setLocalRemark(e.target.value)}
            />
          </div>
          <div className="modal-footer">
            <button
              type='button'
              className="btn btn-primary"
              onClick={async () => { await onSave(localRemark); }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});


export default function EffectCheck({ pscContext = null, onClose = () => {}, mode = '', targetCmId = null }) {
  const [pscs, setPscs] = useState([]);
  const [selected, setSelected] = useState(pscContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);
  const [selectedActions, setSelectedActions] = useState({}); // { cmId: 'accept' | 'reject' | undefined }
const [reasonByCm, setReasonByCm] = useState({});  
  const [selectedCmid, setSelectedCmid] = useState([]);    // array of selected CM ids
  const [confirmMode, setConfirmMode] = useState('');      // "accept" | "reject" | ''
  const [batchRemark, setBatchRemark] = useState('');
const [effectData, setEffectData] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [effectHistory, setEffectHistory] = useState([]);
  // local copy of previous remarks to avoid recalculation every render
  const [previousRemarksLocal, setPreviousRemarksLocal] = useState('');
  

  
  // View states for form/preview pattern
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(!!pscContext);

  const [cmDialog, setCmDialog] = useState({ show: false, cmId: null });
  const [remarksDialog, setRemarksDialog] = useState({ show: false, cm: null, mode: 'accept', remarks: '' }); // mode: 'accept'|'reject'

  // Single-CM mode state
  const [targetCm, setTargetCm] = useState(null);
  const [cmHistory, setCmHistory] = useState([]);
  const [cmLoading, setCmLoading] = useState(false);
  const [finalRemark, setFinalRemark] = useState('');

  const canEdit = useCanEdit(selected, activeEsc);

  useEffect(() => { fetchPscs(); }, []);
  useEffect(() => { loadEscalations().then(list => setEscalations(list)); }, []);
  useEffect(() => { if (pscContext) setSelected(pscContext); }, [pscContext]);

  // If launched in single-CM mode, load that CM and its logs
  useEffect(() => {
    if (!targetCmId) return;
    let mounted = true;
    const load = async () => {
      setCmLoading(true);
      try {
        const cmRes = await axios.get(`/api/countermeasure/${targetCmId}`);
        const logsRes = await axios.get(`/api/countermeasure/${targetCmId}/logs`);
        if (!mounted) return;
        setTargetCm(cmRes.data || null);
        setCmHistory(Array.isArray(logsRes.data) ? logsRes.data : []);
        // if pscContext not provided, attempt to set selected PSC from CM (if CM contains psc id)
        if (!selected && cmRes.data && (cmRes.data.psc_id || cmRes.data.problem_id || cmRes.data.pscId)) {
          try {
            const pscId = cmRes.data.psc_id || cmRes.data.problem_id || cmRes.data.pscId;
            const res = await axios.get(`/api/psc/${pscId}`);
            setSelected(res.data);
          } catch (err) {
            // non-fatal
          }
        }
      } catch (err) {
        console.error('Failed to load countermeasure or logs:', err);
      } finally {
        if (mounted) setCmLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [targetCmId]);



  useEffect(() => {
    if (selected && escalations.length) setActiveEsc(computeEscalationForPsc(selected, escalations));
    else setActiveEsc(null);
  }, [selected, escalations]);

  const loadEffectHistory = useCallback(async () => {
    if (!selected || !selected.id) return;
    try {
      const res = await axios.get(`/api/psc/${selected.id}/effectcheck`);
      setEffectHistory(res.data || []);
    } catch (err) {
      console.error('loadEffectHistory failed', err);
    }
  }, [selected]);

  const fetchPscs = useCallback(async () => {
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
    } catch (err) {
      console.error('fetchPscs failed', err);
    }
  }, []);

  const openPsc = useCallback(async (psc) => {
    try {
      const res = await axios.get(`/api/psc/${psc.id}`);
      setSelected(res.data);
      setShowPreview(true);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to load PSC details:', err);
    }
  }, []);

  const getCountermeasures = useCallback((pscObj) => {
    const rc = pscObj?.root_cause ?? pscObj?.rootCause ?? {};
    if (!rc) return [];
    if (Array.isArray(rc.countermeasures)) return rc.countermeasures;
    if (typeof rc.countermeasures === 'string') {
      try { return JSON.parse(rc.countermeasures || '[]'); } catch { return []; }
    }
    return [];
  }, []);

  

  // const fetchAllPsc = useCallback(async () => {
  //   try {
  //     const res = await axios.get('/api/psc');
  //     setPscs(res.data || []);
  //   } catch (err) {
  //     console.error('Failed to fetch PSC list', err);
  //   }
  // }, []);

  const fetchEffectiveness = useCallback(async (pscId) => {
    try {
      const res = await axios.get(`/api/psc/${pscId}/effectcheck`);
      setEffectData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch effectiveness data', err);
    }
  }, []);

  // useEffect(() => {
  //   if (!pscContext) fetchAllPsc();
  //   else fetchEffectiveness(pscContext.id);
  // }, [pscContext, fetchAllPsc, fetchEffectiveness]);

  const handleSelectPsc = useCallback(async (psc) => {
    setSelected(psc);
    await fetchEffectiveness(psc.id);
  }, [fetchEffectiveness]);

  const submitDecision = async (decision) => {
    if (!selected) return alert('No PSC selected');
    if (!remarks.trim() && !window.confirm('No remarks given. Continue?')) return;

    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      await axios.patch(`/api/psccard/effectcheck/${selected.id}`, {
        effectiveness_status: decision === 'accept' ? 'Accepted' : 'Rejected',
        effectiveness_remark: remarks,
        checked_by: user.id
      });

      alert(`PSC ${decision === 'accept' ? 'Accepted' : 'Rejected'} successfully.`);
      await fetchEffectiveness(selected.id);
      setRemarks('');
      setStatus(decision);
    } catch (err) {
      console.error('Failed to update effectiveness', err);
      alert('Error occurred while updating effectiveness.');
    } finally {
      setLoading(false);
    }
  };


  // // Table view for PSC list (when not in single-psc transaction mode)
  // const TableView = () => (
  //   <div className="card mt-4 full-height">
  //     <div className="card-body">
  //       <div className="d-flex justify-content-between align-items-center mb-3">
  //         <h4 className="card-title">Effectiveness Check</h4>
  //         <div className="d-flex" style={{ width: '40%' }} >
  //           <input className="form-control" placeholder="Search..." value={searchTerm} 
  //           onChange={(e) => setSearchTerm(e.target.value)} />
  //         </div>
  //       </div>
  //       <div className="table-responsive">
  //         <table className="table table-bordered table-hover">
  //           <thead className="thead-light">
  //             <tr>
  //               <th>Problem No</th><th>Initiator</th><th>Date</th><th>Shift</th><th>Value Stream</th><th>Stage</th><th>Status</th>
  //             </tr>
  //           </thead>
  //           <tbody>
  //             {(pscs || []).length > 0 ? (
  //             pscs.filter(p => {
  //               const s = (searchTerm || '').toLowerCase();
  //               const matchesSearch = (
  //                 (p.problem_number || p.problemNumber || '').toString().toLowerCase().includes(s) ||
  //                 (p.initiator_name || p.initiatorName || '').toString().toLowerCase().includes(s) ||
  //                 (p.vl_name || '').toString().toLowerCase().includes(s) ||
  //                 (p.ticket_stage || p.ticketStage || '').toString().toLowerCase().includes(s) ||
  //                 (p.status || '').toString().toLowerCase().includes(s)
  //               );
  //               return matchesSearch;
  //             }).map(psc => (
  //               <tr key={psc.id}>
  //                 <td><button className="btn btn-link p-0" onClick={() => openPsc(psc)}>{psc.problem_number || psc.problemNumber}</button></td>
  //                 <td>{psc.initiator_name || psc.initiatorName}</td>
  //                 <td>{psc.date ? new Date(psc.date).toLocaleDateString('en-CA') : ''}</td>
  //                  <td>{psc.shift_name}</td>
  //                 <td>{psc.vl_name}</td>
  //                 <td>{psc.ticket_stage || psc.ticketStage}</td>
  //                 <td>{psc.status}</td>
  //               </tr>
  //             ))
  //           ) : (
  //             <tr>
  //                 <td colSpan="8" className="text-center">
  //     <div className="spinner-border text-primary" role="status">
  //       <span className="sr-only">Loading...</span>
  //     </div>
  //     </td>
  //             </tr>
  //           )}
  //           </tbody>
  //         </table>
  //       </div>
  //     </div>
  //   </div>
  // );
  const filteredPSCs = useMemo(() => pscs.filter((psc) => {
    const search = searchTerm.toLowerCase();
    const maybe = (v) => (v || '').toString().toLowerCase();
    return (
      maybe(psc.problem_number || psc.problemNumber || '').toLowerCase().includes(search) ||
      maybe(psc.initiator_name || psc.initiatorName || '').toLowerCase().includes(search) ||
      maybe(psc.date || '').toLowerCase().includes(search) ||
      maybe(psc.shift_name || '').toLowerCase().includes(search) ||
      maybe(psc.value_stream_line || psc.valueStreamLine || '').toLowerCase().includes(search) ||
      maybe(psc.ticket_stage || psc.ticketStage || '').toLowerCase().includes(search) ||
      maybe(psc.short_description || psc.shortDescription || '').toLowerCase().includes(search) ||
      maybe(psc.status || '').toLowerCase().includes(search)
    );
  }),[pscs,searchTerm]);
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
          onClick={() => openPsc(psc)}
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



  const TableView = () => (
  <div className="card mt-4 full-height">
    <div className="card-body">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="card-title">Effectiveness Check</h4>

        <div className="d-flex" style={{ width: "40%" }}>
          <input
            className="form-control"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="thead-light">
            <tr>
              <th>Problem No</th>
              <th>Initiator</th>
              <th>Date</th>
              <th>Shift</th>
              <th>Value Stream</th>
              <th>Short Description</th>
              <th>Stage</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
           {renderpsctable()}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

  // Memoize countermeasures derived from selected to avoid recalculation on every render
  const cms = useMemo(() => getCountermeasures(selected) || [], [selected, getCountermeasures]);

  useEffect(() => {
    if (cms.length > 0) {
      const allIds = cms.map(cm => cm.id);
      setSelectedCmid(allIds);
    } else {
      setSelectedCmid([]);
    }
  }, [cms]);
useEffect(() => {
    try {
      const text = (effectHistory || []).map(r => r.remarks).filter(Boolean).join("\n");
      setPreviousRemarksLocal(text);
    } catch (err) {
      setPreviousRemarksLocal('');
    }
  }, [effectHistory]);
  
// Table view:
const PscTransactionView = () => {
  // Handlers for confirm modal save — memoized
  const handleConfirmSave = useCallback (async (remark) => {
    if (!selected) return;
    try {
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      const userRespId = user?.user_resp_id || user?.userresp || null;
          for (const cmId of selectedCmid) {
            await axios.put(`/api/psc/${selected.id}/effectcheck`, {
              countermeasure_id: cmId,
              check_status: confirmMode === "accept" ? "Accepted" : "Rejected",
              checked_by: user.id || null,
              remarks: remark,
              userRespId: userRespId
            });
          }
          setConfirmMode("");
          setSelectedCmid([]);
          await openPsc(selected);
    } catch (err) {
      console.error('Confirm save failed', err);
    }
    }, [selected, selectedCmid, confirmMode, openPsc]);

  if (!selected) return null;

  // reuse memoized cms
  // Helper: get log for remarks
  const getRemarks = (cm) => {
    // Assuming you have log info available for each cm, else fetch when row expands.
    const logs = (cm.logs || []).filter(l => l.type === "Acceptance Remark" || l.type === "Rejection Remark");
    return logs.map(log => log.text).filter(Boolean).join(', ');
  };
  // Keep previous remarks in local state to avoid recomputing and to stabilize textarea value
  
  // Actions/Acceptance/Reject with one click for all
  // Actions/Acceptance/Reject with one click for all
  return (
    
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>Effectiveness Check — {selected.problem_number || selected.problemNumber}</h4>
        <div className="d-flex mb-2">
  <button className="btn btn-success mr-2" type='button'
    // disabled={selectedCmid.length==0}
    onClick={()=>{setConfirmMode('accept');}}>Accept</button>
  <button className="btn btn-danger" type='button'
    // disabled={selectedCmid.length==0}
    onClick={()=>{setConfirmMode('reject');}}>Reject</button>
</div>
        
      </div>
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
             <thead>
  <tr>
    <th>Description</th>
    <th>Target Date</th>
    <th>Type</th>
    <th>Comments</th>
    <th>Status</th>
  </tr>
</thead>
<tbody>
  {cms.map((cm, idx) => (
    <tr key={cm.id}>
      <td>{cm.description}</td>
      <td>{cm.target_date}</td>
      <td>{cm.type}</td>
      <td>
        {cm.comments}
      </td>
      <td>{cm.cm_status}</td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
          
          <div className="modal-body">
          <textarea
            className="form-control"
            placeholder="Remark..."
            value={previousRemarksLocal}
            rows={3} readOnly style={{ minHeight: '100px', maxHeight: '300px' }}
          />
        </div>
          
          
        </div>
      </div>
    <ConfirmModal
      show={!!confirmMode}
      confirmMode={confirmMode}
      initialRemark={batchRemark}
      onClose={() => { setConfirmMode(''); setBatchRemark(''); }}
      onSave={handleConfirmSave}
    />
    

    </div>
    
  );
};

  const PreviewView = () => {
    if (!selected) return null;
    return (
      <div>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <h4>Effect Check Preview — {selected.problem_number || selected.problemNumber}</h4>
          <div>
            {/* <button className="btn btn-secondary mr-2" type='button'  onClick={() => { setShowPreview(false); setSelected(null); }}>Back to List</button> */}
            <button className="btn btn-primary"  type='button' onClick={() => { setShowForm(true); setShowPreview(false);  loadEffectHistory(); }}>
              Review Countermeasures
            </button>
          </div>
        </div>
        <PSCFullView 
          psc={selected} 
          onClose={() => { setShowPreview(false); setSelected(null); }}
          actions={null}
        />
      </div>
    );
  };

  // // If in single-CM mode, render focused review UI
  // if (targetCmId) {
  //   return (
  //     <div>
  //       <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
  //         <h4>Review Countermeasure — {targetCm ? (targetCm.id || '') : targetCmId}</h4>
  //         <div>
  //           <button className="btn btn-secondary mr-2" onClick={() => { if (typeof onClose === 'function') onClose(selected); }}>Close</button>
  //           <button className="btn btn-outline-primary" onClick={async () => {
  //             // refresh CM
  //             if (!targetCmId) return;
  //             try {
  //               const res = await axios.get(`/api/countermeasure/${targetCmId}`);
  //               setTargetCm(res.data);
  //               const logsRes = await axios.get(`/api/countermeasure/${targetCmId}/logs`);
  //               setCmHistory(Array.isArray(logsRes.data) ? logsRes.data : []);
  //             } catch (err) { console.error('refresh cm failed', err); }
  //           }}>Refresh</button>
  //         </div>
  //       </div>

  //       <div className="card">
  //         <div className="card-body">
  //           {cmLoading ? (
  //             <div>Loading countermeasure...</div>
  //           ) : (
  //             <div>
  //               <div className="mb-3">
  //                 <strong>Description:</strong>
  //                 <div className="p-2 border">{targetCm?.description || targetCm?.countermeasure || ''}</div>
  //               </div>
  //               <div className="mb-3"><strong>Target Date:</strong> {targetCm?.targetDate || targetCm?.target_date || ''}</div>
  //               <div className="mb-3"><strong>Type:</strong> {targetCm?.type || ''}</div>
  //               <div className="mb-3"><strong>Status:</strong> {targetCm?.cm_status || targetCm?.status || 'Pending'}</div>

  //               <hr />
  //               <div>
  //                 <h5>History</h5>
  //                 <div style={{ maxHeight: '35vh', overflowY: 'auto', paddingBottom: 8 }}>
  //                   {(!cmHistory || cmHistory.length === 0) ? (
  //                     <div className="text-muted">No history available.</div>
  //                   ) : (
  //                     cmHistory.slice().sort((a,b) => new Date(a.timestamp||0) - new Date(b.timestamp||0)).map(entry => (
  //                       <div key={entry.id} className="mb-2">
  //                         <div style={{ padding: 10, borderRadius: 8, backgroundColor: '#f8f9fa' }}>
  //                           <div style={{ fontWeight: 700 }}>{entry.type || entry.log_type || 'Comment'}</div>
  //                           <div style={{ whiteSpace: 'pre-wrap' }}>{entry.text}</div>
  //                           <div className="text-muted small">{entry.logged_by_name || entry.logged_by || 'System'} — {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</div>
  //                         </div>
  //                       </div>
  //                     ))
  //                   )}
  //                 </div>
  //               </div>

  //               <hr />

  //               <div>
  //                 <div className="form-group">
  //                   <label>Acceptance / Rejection Remark</label>
  //                   <textarea className="form-control" rows={4} value={finalRemark} onChange={e => setFinalRemark(e.target.value)} />
  //                 </div>
  //                 <div style={{ display: 'flex', gap: 8 }}>
  //                   <button className="btn btn-success" onClick={() => handleFinalDecision('accept')} disabled={!canEdit}>Accept</button>
  //                   <button className="btn btn-danger" onClick={() => handleFinalDecision('reject')} disabled={!canEdit}>Reject</button>
  //                 </div>
  //               </div>
  //             </div>
  //           )}
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  // Decide which view to show for non-targetCm mode
  if (showForm) {
    return <PscTransactionView />;
  }
  
  if (showPreview) {
    return <PreviewView />;
  }
  
  return <TableView />;
}