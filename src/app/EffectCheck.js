import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CountermeasureComments from './CountermeasureComments';
import { loadEscalations, computeEscalationForPsc } from './pscPermissions';
import { useCanEdit } from './canEdit';
import PSCFullView from './PSCFullView';
/*
  EffectCheck - approval form version

  Usage:
    - When opened in "transaction" mode it receives a `psc` prop (single PSC object) OR
      it can list PSCs (legacy list view). Here we support both:
      - If prop `pscContext` is provided -> operate on that PSC only (launched from PSCFullView)
      - Otherwise show the list/table of PSCs (full list)
*/

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

  const fetchPscs = async () => {
    try {
      const res = await axios.get('/api/psc');
      setPscs(res.data || []);
    } catch (err) {
      console.error('fetchPscs failed', err);
    }
  };

  const openPsc = async (psc) => {
    try {
      const res = await axios.get(`/api/psc/${psc.id}`);
      setSelected(res.data);
      setShowPreview(true);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to load PSC details:', err);
    }
  };

  const getCountermeasures = (pscObj) => {
    const rc = pscObj?.root_cause ?? pscObj?.rootCause ?? {};
    if (!rc) return [];
    if (Array.isArray(rc.countermeasures)) return rc.countermeasures;
    if (typeof rc.countermeasures === 'string') {
      try { return JSON.parse(rc.countermeasures || '[]'); } catch { return []; }
    }
    return [];
  };
  const toggleAction = (cmId, action) => {
  setSelectedActions(prev => ({
    ...prev,
    [cmId]: prev[cmId] === action ? undefined : action
  }));
};
const handleReason = (cmId, text) => {
  setReasonByCm(prev => ({ ...prev, [cmId]: text }));
};
const submitBatchActions = async () => {
  const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
  const pscId = selected.id;
  const cms = getCountermeasures(selected) || [];

  for (const cm of cms) {
    const action = selectedActions[cm.id];
    if (!action) continue;
    const reason = (reasonByCm[cm.id] || '').trim();
    if (!reason && !window.confirm(`No reason for ${action} CM ${cm.description}. Continue?`)) continue;

    const log_type = action === 'accept' ? 'Acceptance Remark' : 'Rejection Remark';

    // 1. Insert log
    await axios.post(`/api/countermeasure/${cm.id}/logs`, {
      log_type,
      text: reason,
      logged_by: user.id
    });

    // 2. Insert or update effectiveness_check with psccard_id
    await axios.put(`/api/psc/${pscId}/effectcheck`, {
      countermeasure_id: cm.id,
      check_status: action === 'accept' ? 'Accepted' : 'Rejected',
      checked_by: user.id,
      remarks: reason,
      psccard_id: pscId // if your backend expects psccard_id in payload; if not, no need
    });
  }
  // After batch update all, refetch data
  await openPsc(selected);
  alert("Submitted selected actions.");
};


  // Open focused remarks form for a single countermeasure
  const openRemarksFor = (cm, mode = 'accept') => {
    setRemarksDialog({ show: true, cm, mode, remarks: '' });
  };
  const closeRemarks = () => setRemarksDialog({ show: false, cm: null, mode: 'accept', remarks: '' });

  // Core: submit acceptance/rejection using new API shape:
  // PUT /api/psc/:pscId/effectcheck
  // body: { countermeasure_id, check_status, checked_by, remarks }
  const submitDecision = async () => {
    if (!selected || !remarksDialog.cm) return;
    const cm = remarksDialog.cm;
    const mode = remarksDialog.mode;
    const remarks = (remarksDialog.remarks || '').toString().trim();

    if (!remarks) {
      if (!window.confirm('No remarks provided. Proceed anyway?')) return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      const payload = {
        countermeasure_id: cm.id,
        check_status: mode === 'accept' ? 'Accepted' : 'Rejected',
        checked_by: user.id || null,
        remarks: remarks || ''
      };

      // Call new endpoint which will:
      // - insert/update effectiveness_check (linked to CM)
      // - update countermeasure.cm_status
      // - update parent PSC status/ticket_stage
      const res = await axios.put(`/api/psc/${selected.id}/effectcheck`, payload);
      // server returns refreshed PSC, update local selected accordingly
      if (res.data) setSelected(res.data);

      // close form and return to PSCFullView (invoke onClose if provided)
      closeRemarks();
      if (typeof onClose === 'function') onClose(res.data || selected);

      alert(`Countermeasure ${payload.check_status} and logged successfully.`);
    } catch (err) {
      console.error('submitDecision failed', err);
      alert('Failed to submit decision. See console for details.');
    }
  };

  // New: handle final accept/reject in single-CM mode (three-step transaction)
  const handleFinalDecision = async (decision) => {
    if (!targetCm) return alert('No countermeasure loaded.');
    const cmId = targetCm.id;
    const pscId = selected?.id || pscContext?.id || targetCm.psc_id || targetCm.problem_id || targetCm.pscId;
    if (!pscId) return alert('Unable to determine parent PSC for this countermeasure.');
    const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
    const remarkText = (finalRemark || '').toString().trim();
    if (!remarkText) {
      if (!window.confirm('No remark provided. Proceed anyway?')) return;
    }

    try {
      // 1) Update countermeasure status
      await axios.put(`/api/countermeasure/${cmId}`, { cm_status: decision === 'accept' ? 'Accepted' : 'Rejected' });

      // 2) Insert log entry
      await axios.post(`/api/countermeasure/${cmId}/logs`, {
        log_type: decision === 'accept' ? 'Acceptance Remark' : 'Rejection Remark',
        text: remarkText || '',
        logged_by: user.id || null
      });

      // 3) Insert effectiveness_check record. Try POST then fallback to legacy PUT endpoint.
      const effPayload = {
        countermeasure_id: cmId,
        check_status: decision === 'accept' ? 'Accepted' : 'Rejected',
        checked_by: user.id || null,
        remarks: remarkText || ''
      };
      try {
        await axios.post(`/api/psc/${pscId}/effectiveness_check`, effPayload);
      } catch (e) {
        // fallback
        await axios.put(`/api/psc/${pscId}/effectcheck`, effPayload);
      }

      // refresh PSC and/or selected CM
      let updatedPsc = null;
      try {
        const res = await axios.get(`/api/psc/${pscId}`);
        updatedPsc = res.data;
      } catch (err) {
        console.warn('Failed to refresh PSC after decision', err);
      }

      alert(`Countermeasure ${decision === 'accept' ? 'Accepted' : 'Rejected'} and logged successfully.`);
      if (typeof onClose === 'function') onClose(updatedPsc || selected);
    } catch (err) {
      console.error('handleFinalDecision failed', err);
      alert('Failed to submit final decision. See console for details.');
    }
  };

  // Filtered list for transaction view: show only CMs that require review
  const filterForReview = (cms) => {
    return (cms || []).filter(cm => {
      const s = (cm.cm_status || cm.status || '').toString().toLowerCase();
      return s === '' || s === 'pending' || s === 'for validation' || s === 'for validation'.toLowerCase();
    });
  };

  // Table view for PSC list (when not in single-psc transaction mode)
  const TableView = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Effectiveness Check</h4>
          <div style={{ width: '40%' }} className="d-flex">
            <input className="form-control" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr>
                <th>Problem No</th><th>Initiator</th><th>Date</th><th>Shift</th><th>Value Stream</th><th>Stage</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(pscs || []).length > 0 ? (
              pscs.filter(p => {
                const s = (searchTerm || '').toLowerCase();
                const matchesSearch = (
                  (p.problem_number || p.problemNumber || '').toString().toLowerCase().includes(s) ||
                  (p.initiator_name || p.initiatorName || '').toString().toLowerCase().includes(s)
                );
                return matchesSearch;
              }).map(psc => (
                <tr key={psc.id}>
                  <td><button className="btn btn-link p-0" onClick={() => openPsc(psc)}>{psc.problem_number || psc.problemNumber}</button></td>
                  <td>{psc.initiator_name || psc.initiatorName}</td>
                  <td>{psc.date ? new Date(psc.date).toLocaleDateString('en-CA') : ''}</td>
                  <td>{psc.shift}</td>
                  <td>{psc.value_stream_line || psc.valueStreamLine || psc.vl_name}</td>
                  <td>{psc.ticket_stage || psc.ticketStage}</td>
                  <td>{psc.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                  <td colSpan="8" className="text-center">
      <div className="spinner-border text-primary" role="status">
        <span className="sr-only">Loading...</span>
      </div>
      </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

// Table view:
const PscTransactionView = () => {
  if (!selected) return null;
  const cms = getCountermeasures(selected) || [];
  // Helper: get log for remarks
  const getRemarks = (cm) => {
    // Assuming you have log info available for each cm, else fetch when row expands.
    const logs = (cm.logs || []).filter(l => l.type === "Acceptance Remark" || l.type === "Rejection Remark");
    return logs.map(log => log.text).filter(Boolean).join(', ');
  };
  // Actions/Acceptance/Reject with one click for all
  return (
    
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="d-flex gap-2 mb-2">
  <button className="btn btn-success"
    disabled={selectedCmid.length==0}
    onClick={()=>{setConfirmMode('accept');}}>Accept</button>
  <button className="btn btn-danger"
    disabled={selectedCmid.length==0}
    onClick={()=>{setConfirmMode('reject');}}>Reject</button>
</div>
        <h4>Effectiveness Check — {selected.problem_number || selected.problemNumber}</h4>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
             <thead>
  <tr>
    <th>#</th>
    <th>Description</th>
    <th>Target Date</th>
    <th>Type</th>
    <th>Comments</th>
    <th>Status</th>
    <th>Reason</th>
  </tr>
</thead>
<tbody>
  {cms.map((cm, idx) => (
    <tr key={cm.id}>
      <td>
        <input type="checkbox"
            checked={selectedCmid.includes(cm.id)}
            onChange={e=>{
               if(e.target.checked)
                 setSelectedCmid([...selectedCmid,cm.id]);
               else
                 setSelectedCmid(selectedCmid.filter(i=>i!==cm.id));
            }}/>
      </td>
      <td>{cm.description}</td>
      <td>{cm.targetDate}</td>
      <td>{cm.type}</td>
      <td>
        {cm.logs && cm.logs
           .filter(l=>l.type==="User Comment")
           .map(l=>l.log_text).join(', ')}
      </td>
      <td>{cm.cm_status}</td>
      <td>
        {/* Show effectcheck reason: last entry from effectiveness_check for this CM */}
        {cm.effectivenessCheck ? cm.effectivenessCheck.remarks : ""}
      </td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
        </div>
      </div>
     {!!confirmMode && (
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
          <button className="close" onClick={() => { setConfirmMode(""); setBatchRemark(""); }}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <textarea
            rows={4}
            className="form-control"
            placeholder="Remark..."
            value={batchRemark}
            onChange={e => setBatchRemark(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setConfirmMode(""); setBatchRemark(""); }}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
              for (const cmId of selectedCmid) {
                await axios.put(`/api/psc/${selected.id}/effectcheck`, {
                  countermeasure_id: cmId,
                  check_status: confirmMode === "accept" ? "Accepted" : "Rejected",
                  checked_by: user.id || null,
                  remarks: batchRemark
                });
                console.log("selected.id=", selected?.id, "cmId=", cmId);
                await axios.post(`/api/countermeasure/${cmId}/logs`, {
                  log_type: confirmMode === "accept" ? "Accepted" : "Rejection Remark",
                  text: batchRemark,
                  logged_by: user.id || null
                });
              }
              setConfirmMode("");
              setBatchRemark("");
              setSelectedCmid([]);
              await openPsc(selected);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
)}

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
            <button className="btn btn-secondary mr-2" onClick={() => { setShowPreview(false); setSelected(null); }}>Back to List</button>
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setShowPreview(false); }}>
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

  // If in single-CM mode, render focused review UI
  if (targetCmId) {
    return (
      <div>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <h4>Review Countermeasure — {targetCm ? (targetCm.id || '') : targetCmId}</h4>
          <div>
            <button className="btn btn-secondary mr-2" onClick={() => { if (typeof onClose === 'function') onClose(selected); }}>Close</button>
            <button className="btn btn-outline-primary" onClick={async () => {
              // refresh CM
              if (!targetCmId) return;
              try {
                const res = await axios.get(`/api/countermeasure/${targetCmId}`);
                setTargetCm(res.data);
                const logsRes = await axios.get(`/api/countermeasure/${targetCmId}/logs`);
                setCmHistory(Array.isArray(logsRes.data) ? logsRes.data : []);
              } catch (err) { console.error('refresh cm failed', err); }
            }}>Refresh</button>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {cmLoading ? (
              <div>Loading countermeasure...</div>
            ) : (
              <div>
                <div className="mb-3">
                  <strong>Description:</strong>
                  <div className="p-2 border">{targetCm?.description || targetCm?.countermeasure || ''}</div>
                </div>
                <div className="mb-3"><strong>Target Date:</strong> {targetCm?.targetDate || targetCm?.target_date || ''}</div>
                <div className="mb-3"><strong>Type:</strong> {targetCm?.type || ''}</div>
                <div className="mb-3"><strong>Status:</strong> {targetCm?.cm_status || targetCm?.status || 'Pending'}</div>

                <hr />
                <div>
                  <h5>History</h5>
                  <div style={{ maxHeight: '35vh', overflowY: 'auto', paddingBottom: 8 }}>
                    {(!cmHistory || cmHistory.length === 0) ? (
                      <div className="text-muted">No history available.</div>
                    ) : (
                      cmHistory.slice().sort((a,b) => new Date(a.timestamp||0) - new Date(b.timestamp||0)).map(entry => (
                        <div key={entry.id} className="mb-2">
                          <div style={{ padding: 10, borderRadius: 8, backgroundColor: '#f8f9fa' }}>
                            <div style={{ fontWeight: 700 }}>{entry.type || entry.log_type || 'Comment'}</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{entry.text}</div>
                            <div className="text-muted small">{entry.logged_by_name || entry.logged_by || 'System'} — {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <hr />

                <div>
                  <div className="form-group">
                    <label>Acceptance / Rejection Remark</label>
                    <textarea className="form-control" rows={4} value={finalRemark} onChange={e => setFinalRemark(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-success" onClick={() => handleFinalDecision('accept')} disabled={!canEdit}>Accept</button>
                    <button className="btn btn-danger" onClick={() => handleFinalDecision('reject')} disabled={!canEdit}>Reject</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Decide which view to show for non-targetCm mode
  if (showForm) {
    return <PscTransactionView />;
  }
  
  if (showPreview) {
    return <PreviewView />;
  }
  
  return <TableView />;
}