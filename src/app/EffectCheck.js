import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PSCFullView from './PSCFullView';
import CountermeasureComments from './CountermeasureComments';
import { loadEscalations, computeEscalationForPsc } from './pscPermissions';
import { useCanEdit  } from './canEdit';

/*
  Refactored EffectCheck

  - Lists PSCs that have countermeasures (and allows selecting a PSC).
  - When a PSC is selected, shows a panel that lists all countermeasures for that PSC
    with actions: Accept, Reject, View Comments.
  - Accept/Reject open small dialogs to collect acceptance/rejection remarks and then:
      * Update the CM status (Accepted/Rejected)
      * Insert a log row into countermeasure_log (Acceptance Remark / Rejection Remark)
      * Insert/update an effectiveness_check record for audit
      * Update PSC status/ticket_stage appropriately
      * Refresh UI
*/

export default function EffectCheck() {
  const [pscs, setPscs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);

  const [cmDialog, setCmDialog] = useState({ show: false, cmId: null });
  const [acceptDialog, setAcceptDialog] = useState({ show: false, cm: null, remark: '' });
  const [rejectDialog, setRejectDialog] = useState({ show: false, cm: null, reason: '' });

  const canEdit = useCanEdit(selected, activeEsc);

  useEffect(() => { fetchPscs(); }, []);
  useEffect(() => { loadEscalations().then(list => setEscalations(list)); }, []);
  useEffect(() => {
    try {
      const op = localStorage.getItem('openPsc');
      if (op) {
        const p = JSON.parse(op);
        setSelected(p);
        setShowPreview(true);
        localStorage.removeItem('openPsc');
      }
    } catch (e) {}
  }, []);

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

  const openPreview = async (psc) => {
    try {
      const res = await axios.get(`/api/psc/${psc.id}`);
      setSelected(res.data); // includes root_cause and countermeasures
      setShowPreview(true);
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

  // --- Accept flow modal handlers ---
  const openAccept = (cm) => {
    setAcceptDialog({ show: true, cm, remark: '' });
  };
  const closeAccept = () => setAcceptDialog({ show: false, cm: null, remark: '' });

  const handleConfirmAccept = async () => {
    const { cm } = acceptDialog;
    if (!selected || !cm) return;
    try {
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      const now = new Date().toISOString();

      // 1) Update countermeasure status
      await axios.put(`/api/countermeasure/${cm.id}`, {
        cm_status: 'Accepted',
        accepted_by: user.id || null,
        accepted_at: now
      });

      // 2) Insert countermeasure_log acceptance remark
      await axios.post(`/api/countermeasure/${cm.id}/logs`, {
        log_type: 'Acceptance Remark',
        text: acceptDialog.remark || '',
        logged_by: user.id || null
      });

      // 3) Insert/update effectiveness_check audit
      await axios.put(`/api/psc/${selected.id}/effectcheck`, {
        status: 'Accepted',
        checked_by: user.id || null,
        checked_remarks: acceptDialog.remark || ''
      });

      // 4) Move PSC stage/status to completed/action as appropriate
      await axios.put(`/api/psc/${selected.id}`, {
        status: 'Completed',
        ticket_stage: 'Action'
      });

      // Refresh
      await fetchPscs();
      const res = await axios.get(`/api/psc/${selected.id}`);
      setSelected(res.data);
      closeAccept();
      alert('Countermeasure accepted and logged.');
    } catch (err) {
      console.error('Accept action failed', err);
      alert('Failed to accept countermeasure. See console for details.');
    }
  };

  // --- Reject flow modal handlers ---
  const openReject = (cm) => {
    setRejectDialog({ show: true, cm, reason: '' });
  };
  const closeReject = () => setRejectDialog({ show: false, cm: null, reason: '' });

  const handleConfirmReject = async () => {
    const { cm } = rejectDialog;
    if (!selected || !cm) return;
    try {
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      const now = new Date().toISOString();

      // 1) Update countermeasure status
      await axios.put(`/api/countermeasure/${cm.id}`, {
        cm_status: 'Rejected',
        rejection_reason: rejectDialog.reason || '',
        rejected_by: user.id || null,
        rejected_at: now
      });

      // 2) Insert countermeasure_log rejection remark
      await axios.post(`/api/countermeasure/${cm.id}/logs`, {
        log_type: 'Rejection Remark',
        text: rejectDialog.reason || '',
        logged_by: user.id || null
      });

      // 3) Insert/update effectiveness_check audit to record decision
      await axios.put(`/api/psc/${selected.id}/effectcheck`, {
        status: 'Rejected',
        checked_by: user.id || null,
        checked_remarks: rejectDialog.reason || ''
      });

      // 4) Move PSC back to Work in Progress / Do
      await axios.put(`/api/psc/${selected.id}`, {
        status: 'Work in Progress',
        ticket_stage: 'Do'
      });

      // Refresh
      await fetchPscs();
      const res = await axios.get(`/api/psc/${selected.id}`);
      setSelected(res.data);
      closeReject();
      alert('Countermeasure rejected and PSC moved back to DO.');
    } catch (err) {
      console.error('Reject action failed', err);
      alert('Failed to reject countermeasure. See console for details.');
    }
  };

  // Filter PSCs according to search and optionally only those with CMs pending/for validation
  const filteredPSCs = pscs.filter(p => {
    const s = (searchTerm || '').toLowerCase();
    const matchesSearch = (
      (p.problem_number || p.problemNumber || '').toString().toLowerCase().includes(s) ||
      (p.initiator_name || p.initiatorName || '').toString().toLowerCase().includes(s) ||
      (p.date || '').toString().toLowerCase().includes(s) ||
      (p.shift || '').toString().toLowerCase().includes(s) ||
      (p.value_stream_line || p.valueStreamLine || p.vl_name || '').toString().toLowerCase().includes(s) ||
      (p.ticket_stage || p.ticketStage || '').toString().toLowerCase().includes(s) ||
      (p.short_description || p.shortDescription || '').toString().toLowerCase().includes(s) ||
      (p.status || '').toString().toLowerCase().includes(s)
    );
    return matchesSearch;
  });

  const PreviewView = () => {
    if (!selected) return null;
    const cms = getCountermeasures(selected).slice().reverse(); // newest-first
    return (
      <div>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <div><h4>Countermeasures for {selected.problem_number || selected.problemNumber}</h4></div>
          <div>
            <button className='btn btn-secondary mr-2' onClick={() => { setShowPreview(false); setSelected(null); }}>Back to list</button>
            <button className='btn btn-outline-primary' onClick={() => openPreview(selected)}>Refresh</button>
          </div>
        </div>

        <div className='card'>
          <div className='card-body'>
            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="thead-light">
                  <tr>
                    <th>#</th>
                    <th>Countermeasure</th>
                    <th>TargetDate</th>
                    <th>Type</th>
                    <th>Comments</th>
                    <th>Status</th>
                    <th>Rejection</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cms.length > 0 ? cms.map((cm, idx) => (
                    <tr key={cm.id || idx}>
                      <td>{cms.length - idx}</td>
                      <td>{cm.countermeasure || cm.description}</td>
                      <td>{cm.targetDate || cm.counter_target_date || ''}</td>
                      <td>{cm.type || cm.counter_type || ''}</td>
                      <td>{cm.comments || cm.counter_comments || cm.actionRemarks || ''}</td>
                      <td>{(cm.cm_status || cm.status || cm.counter_status || 'Pending')}</td>
                      <td>{cm.rejection_reason || cm.rejectionReason || ''}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className='btn btn-sm btn-success mr-1'
                          onClick={() => openAccept(cm)}
                          disabled={!canEdit || ((cm.cm_status || cm.status || '').toString().toLowerCase() === 'accepted')}
                          title="Accept this countermeasure"
                        >
                          Accept
                        </button>
                        <button
                          className='btn btn-sm btn-warning mr-1'
                          onClick={() => openReject(cm)}
                          disabled={!canEdit || ((cm.cm_status || cm.status || '').toString().toLowerCase() === 'rejected')}
                          title="Reject this countermeasure"
                        >
                          Reject
                        </button>
                        <button
                          className='btn btn-sm btn-outline-secondary'
                          onClick={() => setCmDialog({ show: true, cmId: cm.id })}
                          title="View comments / history"
                        >
                          View Comments
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="8" className="text-center text-muted">No countermeasures found for this PSC</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Accept modal (simple inline dialog) */}
        {acceptDialog.show && (
          <div className="modal show d-block" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="modal-dialog" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Accept Countermeasure</h5>
                  <button type="button" className="close" onClick={closeAccept}><span>&times;</span></button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Countermeasure</label>
                    <div className="p-2 border">{acceptDialog.cm?.countermeasure || acceptDialog.cm?.description || ''}</div>
                  </div>
                  <div className="form-group">
                    <label>Acceptance Remark</label>
                    <textarea className="form-control" rows={4} value={acceptDialog.remark}
                      onChange={e => setAcceptDialog(d => ({ ...d, remark: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeAccept}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleConfirmAccept} disabled={!canEdit}>Confirm Accept</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject modal */}
        {rejectDialog.show && (
          <div className="modal show d-block" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="modal-dialog" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Reject Countermeasure</h5>
                  <button type="button" className="close" onClick={closeReject}><span>&times;</span></button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Countermeasure</label>
                    <div className="p-2 border">{rejectDialog.cm?.countermeasure || rejectDialog.cm?.description || ''}</div>
                  </div>
                  <div className="form-group">
                    <label>Rejection Reason</label>
                    <textarea className="form-control" rows={4} value={rejectDialog.reason}
                      onChange={e => setRejectDialog(d => ({ ...d, reason: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeReject}>Cancel</button>
                  <button className="btn btn-danger" onClick={handleConfirmReject} disabled={!canEdit}>Confirm Reject</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Countermeasure Comments dialog (reusable) */}
        <CountermeasureComments
          cmId={cmDialog.cmId}
          show={cmDialog.show}
          onClose={() => setCmDialog({ show: false, cmId: null })}
          onUpdated={() => {
            // refresh selected PSC when comments change
            (async () => {
              try {
                const res = await axios.get(`/api/psc/${selected.id}`);
                setSelected(res.data);
                await fetchPscs();
              } catch (err) {
                console.error('refresh after comments failed', err);
              }
            })();
          }}
        />
      </div>
    );
  };

  const TableView = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Effectiveness Check</h4>
          <div style={{ width: '40%' }} className="d-flex">
            <input
              className="form-control"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr>
                <th>Problem No</th>
                <th>Initiator</th>
                <th>Date</th>
                <th>Shift</th>
                <th>Value Stream</th>
                <th>Stage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPSCs.length > 0 ? (
                filteredPSCs.map((psc) => (
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
                    <td>{psc.shift}</td>
                    <td>{psc.value_stream_line || psc.valueStreamLine || psc.vl_name}</td>
                    <td>{psc.ticket_stage || psc.ticketStage}</td>
                    <td>{psc.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="text-center text-muted">
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

  return (
    <div>
      {!showPreview && <TableView />}
      {showPreview && <PreviewView />}
    </div>
  );
}