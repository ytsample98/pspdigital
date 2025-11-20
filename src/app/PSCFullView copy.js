import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
//import { loadEscalations, computeEscalationForPsc, hoursSince, isFieldEditable } from './pscPermissions';
import axios from 'axios';
import ProblemCard from './ProblemCard.js';
import { loadEscalations, computeEscalationForPsc, isFieldEditable,hoursSince } from './pscPermissions';

export default function PSCFullView({ psc = {}, actions = null, onClose = () => {}, onOpenEffectCheck = null, openPrint = () => { window.location.href = '/ProblemCard'; } }) {
  const p = psc || {};
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);
  const [elapsedHours, setElapsedHours] = useState(0);
  const [visible, setVisible] = useState(null); 
  const [selected, setSelected] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  const [tab, setTab] = useState('details'); // 'details' or 'countermeasures'
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedCmIndex, setSelectedCmIndex] = useState(-1);
  const [commentsDialog, setCommentsDialog] = useState({ show: false, cmId: null });
  const [showProblemCard, setShowProblemCard] = useState(false);
  const [effectHistory, setEffectHistory] = useState([]);


  useEffect(() => {
    let mounted = true;
    loadEscalations().then(list => { if (mounted) setEscalations(list); });
    const update = () => {
      setElapsedHours(hoursSince(p.created_at));
    };
    update();
    const t = setInterval(() => {
      update();
    }, 60 * 1000); // refresh every minute
    return () => { mounted = false; clearInterval(t); };
  }, [p.date]);

  useEffect(() => {
    const esc = computeEscalationForPsc(p, escalations,user);
    setActiveEsc(esc);
    console.log('esc used')
  }, [escalations, elapsedHours, p]);
  useEffect(() => {
  axios.get(`/api/psc/${p.id}/effectcheck`)
      .then(res => setEffectHistory(res.data || []))
}, [p.id])


  const get = (k) => p[k] ?? p[k.replace(/([A-Z])/g, '_$1').toLowerCase()] ?? '';

  // helper getters for common fields with camel/snake fallback
  const field = (snake, camel) => p[snake] ?? p[camel] ?? '';

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

  // Identify a single target countermeasure for review (priority rules):
  // 1) The most recent CM with status 'For Validation' (case-insensitive).
  // 2) Fallback: the most recent 'Pending' CM that contains comments/counter_comments (indicates it was commented on).
  // If multiple 'For Validation' are found -> treat as error (multiple) and disable review button.
  const findTargetCountermeasure = () => {
    const list = Array.isArray(countermeasuresList) ? countermeasuresList.slice() : [];
    // newest first: assume array is in chronological order, use reversed order to pick most recent
    const newestFirst = list.slice().reverse();
    const forValidation = newestFirst.filter(cm => ((cm.cm_status || cm.status || '') || '').toString().toLowerCase() === 'for validation');
    if (forValidation.length === 1) return { cm: forValidation[0], multiple: false };
    if (forValidation.length > 1) return { cm: null, multiple: true };

    // fallback: most recent pending with comments
    const pendingWithComments = newestFirst.filter(cm => {
      const s = ((cm.cm_status || cm.status || '') || '').toString().toLowerCase();
      if (s !== 'pending') return false;
      const commentsPresent = ((cm.counter_comments || cm.comments || cm.actionRemarks || '') || '').toString().trim() !== '';
      return commentsPresent;
    });
    if (pendingWithComments.length > 0) return { cm: pendingWithComments[0], multiple: false };

    return { cm: null, multiple: false };
  };

  const targetInfo = findTargetCountermeasure();
  const targetCm = targetInfo.cm;


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
   const handlePrint = () => {
    console.log("Print button clicked");
   
setShowProblemCard(true);
  };

    if (showProblemCard) {
    return <ProblemCard psc={psc} activeEsc={activeEsc} />
  }

  const assignedDept = (p.corrective_action?.corrective_assign_to || p.correctiveAction?.corrective_assign_to || p.corrective_assign_to || '');
  const userDept = user?.dept_id || user?.department || user?.dept_name || '';
  const stage = (p.ticket_stage || p.ticketStage || '').toLowerCase();
  const canSeeRootCause = stage === 'Check' && assignedDept && String(userDept) === String(assignedDept);
  const canSeeCorrective =  stage === 'Plan';
  const hasAcceptedCM = countermeasuresList.some(cm => (cm.status || cm.cm_status || '').toString().toLowerCase() === 'accepted');
  const canSeeEffectCheck = stage === 'Action' && hasAcceptedCM;
  p.effectcheck_history = effectHistory
  console.log('corrective done',corrective.username)
    console.log('corrective done',corrective.done_by)


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

            <button type="button" onClick={handlePrint}>
        Print
      </button>
            {/* --- Stage-based actions --- */}
            {canSeeCorrective && actions && actions.type?.name === 'CorrectiveAction' && actions}
            {canSeeRootCause && actions && actions.type?.name === 'RootCause' && actions}
            {canSeeEffectCheck && (
              <div>
                {/* Single review button that forwards only the target CM id (if available) */}
                <button
                  className="btn btn-primary mr-2"
                  disabled={!targetCm || targetInfo.multiple}
                  onClick={() => {
                    if (!targetCm) return;
                    const cmId = targetCm.id || targetCm.countermeasure_id || targetCm.id_countermeasure || null;
                    if (onOpenEffectCheck) {
                      try { onOpenEffectCheck(p, cmId); } catch (e) { console.error('onOpenEffectCheck error', e); }
                      return;
                    }
                    // fallback: store and navigate
                    try {
                      localStorage.setItem('openPsc', JSON.stringify(p));
                      localStorage.setItem('openCmId', cmId);
                      window.location.href = '/effectcheck';
                    } catch (e) {
                      console.error('failed to open effect check', e);
                    }
                  }}
                >
                  {targetInfo.multiple ? 'Multiple CMs to review' : (targetCm ? `Review CM ${targetCm.id || targetCm.countermeasure_id || ''}` : 'No CM to review')}
                </button>
              </div>
            )}
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
                <div className='form-group col-md-2'><label>Shift</label><div>{p.shift_name}</div></div>
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
                <div className='form-group col-md-2'><label>Line</label><div>{p.line_name || ''}</div></div>
                <div className='form-group col-md-2'><label>Qty Affected:</label><div>{p.qty_affected || p.qtyAffected || ''}</div></div>
                <div className='form-group col-md-2'><label>Part:</label> <div>{p.part_affected || p.partAffected || ''}</div></div>
                <div className='form-group col-md-2'><label>Supplier:</label> <div>{p.supplier || ''}</div></div>
                <div className='form-group col-md-2'><label> KPI:</label>
<div>
    {{
      S: 'Safety',
      Q: 'Quality',
      D: 'Delivery',
      C: 'Cost',
      E: 'Environment',
    }[p.problem_type] || '-'}
  </div> 
  
</div>

                
</div>
          

              <div className='form-group mt-2'><label>Problem Description</label>
                <div style={{ minHeight: 60, ...editableHint('problem_description') }}>{p.problem_description || p.problemDescription}</div>
              </div>
              {/* Corrective Action Details */}
              <div className="form-group mt-3">
                <label>Containment Action</label>
                <div style={{ border: '1px solid #ddd', padding: 8 }}>
                  <div><strong>Containment Action:</strong> {corrective.initialContainmentAction || corrective.action_taken || ''}</div>
                  <div><strong>Done By:</strong> {corrective.username}</div>
                  <div><strong>Assign To:</strong> {corrective.dept_name}</div>
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
        {/* <th>Rejection Details</th> */}
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
              <td>{cm.countermeasure || cm.description}</td>
              <td>{cm.target_date ? new Date(cm.target_date).toLocaleDateString('en-CA') : ''}</td>
              <td>{cm.type}</td>
              <td>{cm.comments || ''}</td>
              <td>{cm.cm_status}</td>
             {/* <td> {cm.status === 'Rejected' ? (cm.rejection_reason): ''}</td> */}
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

    {/* <div style={editableHint('effectiveness_checked')}>
      <strong>Checked:</strong> {p.effectiveness_checked || p.effectivenessCheck || ''}
    </div>

    <div style={editableHint('effectiveness_date')}>
      <strong>Date:</strong> {p.effectiveness_date || p.effectivenessDate || ''}
    </div>

    <div style={editableHint('effectiveness_remarks')}>
      <strong>Remarks:</strong> {p.effectiveness_remarks || p.effectivenessRemarks || ''}
    </div> */}

    {/* ---------------------- NEW PLACEHOLDERS ---------------------- */}
    {p.effectcheck_history && p.effectcheck_history.length > 0 && (
      <div style={{ marginTop: 10 }}>
        {/* <strong>Previous Effectiveness Notes:</strong> */}

        <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
          {p.effectcheck_history.map((h, idx) => (
            <div key={idx} style={{ marginBottom: 6 }}>
              {/* <span style={{ fontWeight: 600 }}>
                {h.check_status === 'Accepted' ? '✅ Accepted:' : '❌ Rejected:'}
              </span> */}
               <div>
      <strong>Checked:</strong> {h.remarks || '-'}
    </div>
{/* 
              <div>
      <strong>Date:</strong>                {h.checked_at ? new Date(h.checked_at).toLocaleString() : ''}

    </div> */}

             
            </div>
          ))}
        </div>
      </div>
    )}

  </div>
</div>


            </div>

            
          </div>
        </div>
      </div>

      {/* Rejection Modal 
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
      )}*/}
    </div>
  );
}


