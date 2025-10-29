import React, { useEffect, useState } from 'react';
import { loadEscalations, computeEscalationForPsc, hoursSince, isFieldEditable } from './pscPermissions';
import axios from 'axios';

// Reusable full-page PSC display. Accepts:
// - psc: the PSC object
// - actions: optional JSX to render action buttons (placed top-right and bottom)
// - onClose: handler to return to list
export default function PSCFullView({ psc = {}, actions = null, onClose = () => {} }) {
  const p = psc || {};
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);
  const [elapsedHours, setElapsedHours] = useState(0);
  const [tab, setTab] = useState('details'); // 'details' or 'countermeasures'
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedCmIndex, setSelectedCmIndex] = useState(-1);

  useEffect(() => {
    let mounted = true;
    loadEscalations().then(list => { if (mounted) setEscalations(list); });
    const update = () => {
      setElapsedHours(hoursSince(p.date || p.created_at || p.createdAt || new Date()));
    };
    update();
    const t = setInterval(() => {
      update();
    }, 60 * 1000); // refresh every minute
    return () => { mounted = false; clearInterval(t); };
  }, [p.date]);

  useEffect(() => {
    const esc = computeEscalationForPsc(p, escalations);
    setActiveEsc(esc);
  }, [escalations, elapsedHours, p]);

  const get = (k) => p[k] ?? p[k.replace(/([A-Z])/g, '_$1').toLowerCase()] ?? '';

  // helper getters for common fields with camel/snake fallback
  const field = (snake, camel) => p[snake] ?? p[camel] ?? '';


  // get current user early so other handlers can use it
  const user = (() => { try { return JSON.parse(localStorage.getItem('dcmsUser')); } catch(e){return null;} })();

  // root cause may be returned as `root_cause` (snake) or `rootCause` (camel) by different endpoints
  const rootCauseObj = (() => {
    const rcRaw = p.root_cause ?? p.rootCause ?? null;
    if (!rcRaw) return {};
    if (typeof rcRaw === 'string') {
      try { return JSON.parse(rcRaw || '{}'); } catch { return {}; }
    }
    return rcRaw;
  })();

  const whyList = [
    rootCauseObj.why1 || rootCauseObj.why_1 || p.why1 || p.why_1 || '',
    rootCauseObj.why2 || rootCauseObj.why_2 || p.why2 || p.why_2 || '',
    rootCauseObj.why3 || rootCauseObj.why_3 || p.why3 || p.why_3 || '',
    rootCauseObj.why4 || rootCauseObj.why_4 || p.why4 || p.why_4 || '',
    rootCauseObj.why5 || rootCauseObj.why_5 || p.why5 || p.why_5 || ''
  ].filter(w => w && w.toString().trim() !== '');
// prefer countermeasures array (first item) else legacy countMeasure
const countMeasure = (rootCauseObj && Array.isArray(rootCauseObj.countermeasures) && rootCauseObj.countermeasures.length > 0)
  ? rootCauseObj.countermeasures[0].countermeasure
  : rootCauseObj.countMeasure || '';

let countermeasuresList = [];
if (rootCauseObj.countermeasures && Array.isArray(rootCauseObj.countermeasures)) {
  countermeasuresList = rootCauseObj.countermeasures;
} else if (typeof rootCauseObj.countermeasures === 'string') {
  try {
    countermeasuresList = JSON.parse(rootCauseObj.countermeasures);
  } catch {
    countermeasuresList = [];
  }
}
const acceptCountermeasure = async (idx) => {
  if (!p.id) return;
  const item = countermeasuresList[idx];
  if (!item) return;

  try {
    // Mark selected countermeasure as Accepted
    const updated = { ...rootCauseObj };
    if (!Array.isArray(updated.countermeasures)) updated.countermeasures = [];

    const arr = updated.countermeasures.map((c, i) =>
      i === idx ? { ...c, status: 'Accepted', acceptedBy: user?.id, acceptedAt: new Date().toISOString() } : c
    );
    updated.countermeasures = arr;

    const rcPayload = {
      why1: updated.why1 || '',
      why2: updated.why2 || '',
      why3: updated.why3 || '',
      why4: updated.why4 || '',
      why5: updated.why5 || '',
      filled_by: user?.id || null,
      countermeasures: updated.countermeasures.map(c => ({
        countermeasure: c.countermeasure || '',
        targetDate: c.targetDate || null,
        type: c.type || '',
        actionRemarks: c.actionRemarks || '',
        assignTo: c.assignTo || null,
        comments: c.comments || '',
        status: c.status || 'Pending',
        acceptedBy: c.acceptedBy || c.accepted_by || null,
        acceptedAt: c.acceptedAt || c.accepted_at || null,
        rejectionReason:  c.rejection_reason || null,
        rejectedBy: c.rejectedBy || c.rejected_by || null,
        rejectedAt: c.rejectedAt || c.rejected_at || null
      }))
    };

    await axios.put(`/api/psc/${p.id}/rootcause`, rcPayload);

    // Immediately trigger effectiveness check
    const effPayload = {
      status: 'Accepted',
      checked_by: user?.id || null,
      checked_remarks: item.actionRemarks || item.comments || ''
    };
    await axios.put(`/api/psc/${p.id}/effectcheck`, effPayload);

    onClose();
  } catch (err) {
    console.error('Accept failed', err);
    alert('Could not accept countermeasure.');
  }
};
  const rejectCountermeasure = (idx) => {
    setSelectedCmIndex(idx);
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      // Update countermeasure status via rootcause endpoint so data is stored in root_cause + countermeasure tables
      const updated = { ...rootCauseObj };
      if (!Array.isArray(updated.countermeasures)) updated.countermeasures = [];
      const arr = updated.countermeasures.map((c, i) =>
        i === selectedCmIndex ? { ...c, status: 'Rejected', rejectionReason: rejectReason, rejectedBy: user?.id, rejectedAt: new Date().toISOString() } : c
      );
      updated.countermeasures = arr;
      const rcPayload = {
        why1: updated.why1 || updated.why_1 || '',
        why2: updated.why2 || updated.why_2 || '',
        why3: updated.why3 || updated.why_3 || '',
        why4: updated.why4 || updated.why_4 || '',
        why5: updated.why5 || updated.why_5 || '',
        filled_by: updated.filled_by || user?.id || null,
        countermeasures: updated.countermeasures.map(c => ({
          countermeasure: c.countermeasure || c.counterMeasure || '',
          targetDate: c.targetDate || c.counter_target_date || '',
          type: c.type  || c.counter_type || '',
          actionRemarks: c.actionRemarks || c.counter_action_remarks || '',
          assignTo: c.assignTo || c.counter_assign_to || null,
          comments: c.comments || c.counter_comments || '',
          status: c.status || 'Pending',
          acceptedBy: c.acceptedBy || c.accepted_by || null,
          acceptedAt: c.acceptedAt || c.accepted_at || null,
          rejectionReason: c.rejection_reason || null,
          rejectedBy: c.rejectedBy || c.rejected_by || null,
          rejectedAt: c.rejectedAt || c.rejected_at || null
        }))
      };
      await axios.put(`/api/psc/${p.id}/rootcause`, rcPayload);
      setShowRejectModal(false);
      setRejectReason('');
      onClose();
    } catch (err) {
      console.error('Reject failed', err);
      alert('Could not reject countermeasure.');
    }
  };

  // corrective action display
  let corrective = p.corrective_action || p.correctiveAction || p.corrective_action || {};
  if (typeof corrective === 'string') {
    try { corrective = JSON.parse(corrective || '{}'); } catch(e) { corrective = { text: corrective }; }
  }


  const editableHint = (fieldKey) => {
    try {
      const editable = isFieldEditable(fieldKey, p, user, activeEsc);
      return editable ? { border: '1px', padding: 6 } : { border: '1px solid transparent', padding: 6,  };
    } catch (e) { return { border: '1px solid transparent', padding: 6 }; }
  };

  // --- Stage-based and department-based visibility logic ---
  // Get current user (already defined above)
  // Get assigned department for rootcause
  const assignedDept = (p.corrective_action?.corrective_assign_to || p.correctiveAction?.corrective_assign_to || p.corrective_assign_to || '');
  const userDept = user?.dept_id || user?.department || user?.dept_name || '';
  // Get ticket stage
  const stage = (p.ticket_stage || p.ticketStage || '').toLowerCase();
  // Helper: is user allowed to see rootcause form?
  const canSeeRootCause = stage === 'Check' && assignedDept && String(userDept) === String(assignedDept);
  // Helper: is user allowed to see corrective form?
  const canSeeCorrective =  stage === 'Plan';
  // Helper: is user allowed to see effectiveness check?
  const hasAcceptedCM = countermeasuresList.some(cm => (cm.status || '').toLowerCase() === 'accepted');
  const canSeeEffectCheck = stage === 'Action' && hasAcceptedCM;

  return (
    <div className="psc-fullview container-fluid" style={{ padding: 18 }}>
      <div className="d-flex justify-content-between align-items-start mb-3">
        {/* Left side — Title and Problem info */}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Problem Solving Card</div>
          
        </div>

        {/* Right side — Back + Actions + Escalation */}
        <div className="text-right">
          <div className="d-flex justify-content-end align-items-center" style={{ gap: '8px' }}>
            <button
              className="btn btn-sm btn-outline-danger d-flex align-items-center"
              onClick={onClose}
              style={{ fontWeight: 600, padding: '4px 10px', display: 'flex', gap: '5px' }}
            >
              <i className="mdi mdi-arrow-left"></i> Back
            </button>
            {/* --- Stage-based actions --- */}
            {canSeeCorrective && actions && actions.type?.name === 'CorrectiveAction' && actions}
            {canSeeRootCause && actions && actions.type?.name === 'RootCause' && actions}
            {canSeeEffectCheck && actions && actions.type?.name === 'EffectCheck' && actions}
            {/* fallback: show actions if not a form */}
            {!canSeeCorrective && !canSeeRootCause && !canSeeEffectCheck && actions}
          </div>
        </div>
      </div>


      <div className='card'>
        <div className='card-body'>
          <div className='row'>
            <div className='col-md-12'>
              <div className='form-row'>
                <div className='form-group col-md-2'><label>Problem No</label><div>{field('problem_number','problemNumber')}</div></div>
                <div className='form-group col-md-2'><label>Name</label><div>{field('initiator_name','initiatorName')}</div></div>
                <div className='form-group col-md-2'><label>Date</label><div>{p.date ? new Date(p.date).toLocaleDateString('en-CA') : ''}</div></div>
                <div className='form-group col-md-2'><label>Shift</label><div>{p.shift}</div></div>
                <div className='form-group col-md-2'></div>
                 <div className='col-md-2 d-flex flex-column justify-content-end' style={{ gap: '6px' }}>
            <div style={{ gap: '6px' }}>
    <span className="badge badge-info" style={{ fontSize: 13 }}>
      Stage: {p.ticket_stage || p.ticketStage || 'N/A'}
    </span>
<div style={{ gap: '6px' }}>      
     <span className="badge badge-primary" style={{ fontSize: 13 }}>
      Status: {p.status || 'N/A'}
    </span>
    </div>
   <div style={{ gap: '6px' }}>      

    <span className="badge badge-danger" style={{ fontSize: 13 }}>
      Escalated: {activeEsc?.escalation_name || 'Escalated'}
    </span>
    </div>
    </div>
  </div>


                </div>
                <div className='form-row'>
                <div className='form-group col-md-2'><label>Line</label><div>{p.line_code || p.lineCode || p.line}</div></div>
                <div className='form-group col-md-2'><label>Qty Affected:</label><div>{p.qty_affected || p.qtyAffected || ''}</div></div>
                <div className='form-group col-md-2'><label>Part:</label> <div>{p.part_affected || p.partAffected || ''}</div></div>
                <div className='form-group col-md-2'><label>Supplier:</label> <div>{p.supplier || ''}</div></div>
                
</div>
          

              <div className='form-group mt-2'><label>Problem Description</label>
                <div style={{ minHeight: 60, ...editableHint('problem_description') }}>{p.problem_description || p.problemDescription}</div>
              </div>
              {/* Corrective Action Details */}
              <div className="form-group mt-3">
                <label>Containment Action</label>
                <div style={{ border: '1px solid #ddd', padding: 8 }}>
                  <div><strong>Containment Action:</strong> {corrective.initialContainmentAction || corrective.action_taken || ''}</div>
                  <div><strong>Done By:</strong> {corrective.doneBy || corrective.done_by || ''}</div>
                  <div><strong>Assign To:</strong> {corrective.assignTo || corrective.corrective_assign_to || ''}</div>
                  <div><strong>Remarks:</strong> {corrective.remarks || corrective.corrective_comments || ''}</div>
                </div>
              </div>

              <div className='form-group mt-3'>
                <label>Root Cause Analysis / 5W</label>
                <div style={{ border: '1px solid #ddd', padding: 8, minHeight: 120 }}>
                  {whyList.map((w, i) => (
                    <div key={i} style={editableHint(`why${i+1}`)}><strong>Why {i+1}:</strong> {w || ''}</div>
                  ))}
                </div>
              </div>

              <div className='form-group mt-3'>
                <label>Planned countermeasure / Description</label>
                <div style={{ border: '1px solid #ddd', padding: 8 }}>
                 <div className="table-responsive mt-3">
  <table className="table table-bordered table-hover">
    <thead className="thead-light">
      <tr style={{ fontSize: '14px' }}>
        <th>#</th>
        <th>Countermeasure</th>
        <th>Target Date</th>
        <th>Type</th>
        <th>Comments</th>
        <th>Status</th>
        <th>Rejection Details</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {countermeasuresList.length > 0 ? (
        countermeasuresList
          .slice() // clone array
          .reverse() // newest first
          .map((cm, i) => (
            <tr key={i}>
              <td>{countermeasuresList.length - i}</td>
              <td>{cm.countermeasure}</td>
              <td>{cm.counter_target_date|| ''}</td>
              <td>{cm.counter_type|| ''}</td>
              <td>{cm.counter_comments || ''}</td>
              <td>{cm.status || 'Pending'}</td>
             <td>
  {cm.status === 'Rejected' ? (cm.rejection_reason): ''}
</td>
              <td>
                        <button
                          className="btn btn-sm btn-success mr-2"
                          onClick={() => acceptCountermeasure(countermeasuresList.length - i - 1)}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => rejectCountermeasure(countermeasuresList.length - i - 1)}
                        >
                          Reject
                        </button>
                      
                  
                
              </td>
            </tr>
          ))
      ) : (
        <tr>
          <td colSpan="10" className="text-center text-muted">
            No countermeasures submitted yet.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>

                </div>
              </div>

              <hr />
              <div className='form-group'>
                <label>Effectiveness check / Description</label>
                <div style={{ border: '1px solid #ddd', padding: 8 }}>
                    <div style={editableHint('effectiveness_checked')}><strong>Checked:</strong> {p.effectiveness_checked || p.effectivenessCheck || ''}</div>
                    <div style={editableHint('effectiveness_date')}><strong>Date:</strong> {p.effectiveness_date || p.effectivenessDate || ''}</div>
                    <div style={editableHint('effectiveness_remarks')}><strong>Remarks:</strong> {p.effectiveness_remarks || p.effectivenessRemarks || ''}</div>
                </div>
              </div>

            </div>

            
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="modal show d-block" tabIndex="-1" role="dialog" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Reject Countermeasure</h5>
                <button type="button" className="close" onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}>
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Reason for Rejection:</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmReject}
                  disabled={!rejectReason.trim()}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
