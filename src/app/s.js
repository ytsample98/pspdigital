import React, { useEffect, useState } from 'react';
import { loadEscalations, computeEscalationForPsc, hoursSince, isFieldEditable } from './pscPermissions';
import axios from 'axios';
import CountermeasureComments from './CountermeasureComments';

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
  const [selectedCmIndex, setSelectedCmIndex] = useState(-1);
  const [commentsDialog, setCommentsDialog] = useState({ show: false, cmId: null });

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

  const editableHint = (fieldKey) => {
    try {
      const editable = isFieldEditable(fieldKey, p, user, activeEsc);
      return editable ? { border: '1px', padding: 6 } : { border: '1px solid transparent', padding: 6,  };
    } catch (e) { return { border: '1px solid transparent', padding: 6 }; }
  };

  // Stage/visibility helpers retained for other UI logic
  const assignedDept = (p.corrective_action?.corrective_assign_to || p.correctiveAction?.corrective_assign_to || p.corrective_assign_to || '');
  const userDept = user?.dept_id || user?.department || user?.dept_name || '';
  const stage = (p.ticket_stage || p.ticketStage || '').toLowerCase();
  const canSeeRootCause = stage === 'Check' && assignedDept && String(userDept) === String(assignedDept);
  const canSeeCorrective =  stage === 'Plan';
  const hasAcceptedCM = countermeasuresList.some(cm => (cm.status || cm.cm_status || '').toString().toLowerCase() === 'accepted');
  const canSeeEffectCheck = stage === 'Action' && hasAcceptedCM;

  return (
    <div className="psc-fullview container-fluid" style={{ padding: 18 }}>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Problem Solving Card</div>
        </div>

        <div className="text-right">
          <div className="d-flex justify-content-end align-items-center" style={{ gap: '8px' }}>
            <button
              className="btn btn-sm btn-outline-danger d-flex align-items-center"
              onClick={onClose}
              style={{ fontWeight: 600, padding: '4px 10px', display: 'flex', gap: '5px' }}
            >
              <i className="mdi mdi-arrow-left"></i> Back
            </button>
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

              <div className="form-group mt-3">
                <label>Containment Action</label>
                <div style={{ border: '1px solid #ddd', padding: 8 }}>
                  <div><strong>Containment Action:</strong> {p.corrective_action?.initialContainmentAction || p.correctiveAction?.initialContainmentAction || ''}</div>
                  <div><strong>Done By:</strong> {p.corrective_action?.doneBy || p.correctiveAction?.doneBy || ''}</div>
                  <div><strong>Assign To:</strong> {p.corrective_action?.assignTo || p.correctiveAction?.assignTo || p.corrective_assign_to || ''}</div>
                  <div><strong>Remarks:</strong> {p.corrective_action?.remarks || p.correctiveAction?.remarks || ''}</div>
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
        <th>History</th>
      </tr>
    </thead>
    <tbody>
      {countermeasuresList.length > 0 ? (
        countermeasuresList
          .slice() // clone array
          .reverse() // newest first
          .map((cm, i) => (
            <tr key={cm.id || i}>
              <td>{countermeasuresList.length - i}</td>
              <td>{cm.countermeasure || cm.description}</td>
              <td>{cm.targetDate|| cm.counter_target_date || ''}</td>
              <td>{cm.type|| cm.counter_type || ''}</td>
              <td>{cm.counter_comments || cm.comments || cm.actionRemarks || ''}</td>
              <td>{cm.status || cm.cm_status || 'Pending'}</td>
             <td> {((cm.status || cm.cm_status) === 'Rejected') ? (cm.rejection_reason || cm.rejectionReason): ''}</td>
             <td>
               <button className="btn btn-sm btn-outline-primary" onClick={() => setCommentsDialog({ show: true, cmId: cm.id })}>
                 View Comments
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

      {/* Reusable comments dialog */}
      <CountermeasureComments
        cmId={commentsDialog.cmId}
        show={commentsDialog.show}
        onClose={() => setCommentsDialog({ show: false, cmId: null })}
      />
    </div>
  );
}