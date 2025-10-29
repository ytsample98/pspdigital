import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PSCFullView from './PSCFullView';
import { loadEscalations, computeEscalationForPsc, isFieldEditable } from './pscPermissions';
import { useCanEdit  } from './canEdit';

export default function EffectCheck() {
  const [pscs, setPscs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [remarks, setRemarks] = useState(''); // used for rejection reason (stored on countermeasure.rejection_reason)
  const [description, setDescription] = useState(''); // used for acceptance description (stored in effectiveness_check.checked_remarks)
  const [showPreview, setShowPreview] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [acceptFormVisible, setAcceptFormVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);
  const canEdit = useCanEdit(selected, activeEsc);

  useEffect(() => { fetchPscs(); }, []);
  useEffect(() => { loadEscalations().then(list => setEscalations(list)); }, []);
  useEffect(() => {
    // support quick-open from PSCList
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
// Replace the existing hasPendingCountermeasure function with this:
const hasPendingCountermeasure = (psc) => {
  const cms = psc?.root_cause?.countermeasures || [];
  return cms.some(cm => {
    const s = (cm?.status || '').toString().trim().toLowerCase();
    // treat empty status as pending (newly created row may have no status yet)
    return s === '' || s === 'pending' || s === 'pending effect check';
  });
};

// Replace the existing getLatestPendingCM function with this:
const getLatestPendingCM = (psc) => {
  const cms = psc?.root_cause?.countermeasures || [];
  // use a shallow copy and reverse to avoid mutating original array
  return [...cms].reverse().find(cm => {
    const s = (cm?.status || '').toString().trim().toLowerCase();
    return s === '' || s === 'pending' || s === 'pending effect check';
  }) || null;
};

  const handleSelect = psc => {
    setSelected(psc);
    setShowPreview(true);
    setShowForm(false);
    setAcceptFormVisible(false);
    setRemarks('');
    setDescription('');
  };

  const openPreview = (psc) => { handleSelect(psc); };

  const openActionForm = () => { setShowForm(true); setShowPreview(false); };

  // ACCEPT flow:
  // 1) Update the latest CM status to 'Accepted' (and set acceptedBy/acceptedAt) by re-sending the CM list to /api/psc/:id/rootcause
  //    -> backend will replace countermeasures and persist status/accepted metadata (server expects countermeasures array in rootcause PUT)
  // 2) Call /api/psc/:id/effectcheck with status='Accepted' to create/update the effectiveness_check record and move ticket stage/status.
  const handleAccept = async () => {
    if (!selected) return;
    const cm = getLatestPendingCM(selected);
    if (!cm) {
      alert('No pending countermeasure found to accept.');
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      const now = new Date().toISOString();

      // Build updated countermeasures array based on selected.root_cause.countermeasures
      const existingCms = selected.root_cause?.countermeasures || [];
      const updatedCms = existingCms.map(c => {
        if (c.id === cm.id) {
          // mark this CM as accepted and attach metadata
          return {
            ...c,
            status: 'Accepted',
            acceptedBy: user.id || null,     // stored as accepted_by in DB mapping
            acceptedAt: now                  // stored as accepted_at in DB mapping
          };
        }
        return { ...c };
      });

      // --- STEP 1: Persist CM status change via existing rootcause endpoint ---
      // The rootcause endpoint in the server replaces countermeasures for the root_cause row.
      // We send why-fields (if available) plus the full CM list so backend can upsert correctly.
      await axios.put(`/api/psc/${selected.id}/rootcause`, {
        why1: selected.root_cause?.why1 || '',
        why2: selected.root_cause?.why2 || '',
        why3: selected.root_cause?.why3 || '',
        why4: selected.root_cause?.why4 || '',
        why5: selected.root_cause?.why5 || '',
        filled_by: selected.root_cause?.filled_by || user.id || null,
        countermeasures: updatedCms.map(c => ({
          // ensure payload fields match server expectations (server maps many fields)
          countermeasure: c.countermeasure || '',
          targetDate: c.targetDate || c.counter_target_date || null,
          type: c.type || c.counter_type || null,
          actionRemarks: c.actionRemarks || c.counter_action_remarks || null,
          assignTo: c.assignTo || c.counter_assign_to || null,
          comments: c.comments || c.counter_comments || null,
          status: c.status || 'Pending',
          acceptedBy: c.acceptedBy || c.accepted_by || null,
          acceptedAt: c.acceptedAt || c.accepted_at || null,
          rejectionReason: c.rejectionReason || c.rejection_reason || null,
          rejectedBy: c.rejectedBy || c.rejected_by || null,
          rejectedAt: c.rejectedAt || c.rejected_at || null
        }))
      });

      // --- STEP 2: Create/update effectiveness_check and move PSC stage/status ---
      // The effectcheck endpoint expects: { status, checked_by, checked_remarks }
      // We store acceptance description into effectiveness_check.checked_remarks
      await axios.put(`/api/psc/${selected.id}/effectcheck`, {
        status: 'Accepted',
        checked_by: user.id || null,
        checked_remarks: description || ''
      });

      // refresh UI from server
      await fetchPscs();
      // load updated PSC into preview (or close)
      const res = await axios.get(`/api/psc/${selected.id}`);
      setSelected(res.data);
      setAcceptFormVisible(false);
      setShowPreview(true);
      alert('Countermeasure accepted and PSC advanced.'); // UX hint
    } catch (err) {
      console.error('handleAccept failed:', err);
      alert('Failed to accept countermeasure. See console for details.');
    }
  };

  // REJECT flow:
  // 1) Update the latest CM status to 'Rejected' with rejection_reason, rejectedBy/rejectedAt via rootcause PUT
  // 2) Move the PSC back to "Do" (Work in Progress) so the owner can add the next CM (we use the generic PSC update endpoint)
  const handleReject = async () => {
    if (!selected) return;
    const cm = getLatestPendingCM(selected);
    if (!cm) {
      alert('No pending countermeasure found to reject.');
      return;
    }
    if (!remarks || !remarks.trim()) {
      if (!window.confirm('No rejection reason provided. Are you sure you want to reject without a reason?')) {
        return;
      }
    }

    try {
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      const now = new Date().toISOString();

      // Build updated CM array with rejection metadata
      const existingCms = selected.root_cause?.countermeasures || [];
      const updatedCms = existingCms.map(c => {
        if (c.id === cm.id) {
          return {
            ...c,
            status: 'Rejected',
            rejectionReason: remarks || null,
            rejectedBy: user.id || null,
            rejectedAt: now
          };
        }
        return { ...c };
      });

      // Persist rejection via rootcause endpoint (replaces CM rows)
      await axios.put(`/api/psc/${selected.id}/rootcause`, {
        why1: selected.root_cause?.why1 || '',
        why2: selected.root_cause?.why2 || '',
        why3: selected.root_cause?.why3 || '',
        why4: selected.root_cause?.why4 || '',
        why5: selected.root_cause?.why5 || '',
        filled_by: selected.root_cause?.filled_by || user.id || null,
        countermeasures: updatedCms.map(c => ({
          countermeasure: c.countermeasure || '',
          targetDate: c.targetDate || c.counter_target_date || null,
          type: c.type || c.counter_type || null,
          actionRemarks: c.actionRemarks || c.counter_action_remarks || null,
          assignTo: c.assignTo || c.counter_assign_to || null,
          comments: c.comments || c.counter_comments || null,
          status: c.status || 'Pending',
          acceptedBy: c.acceptedBy || c.accepted_by || null,
          acceptedAt: c.acceptedAt || c.accepted_at || null,
          rejectionReason: c.rejectionReason || c.rejection_reason || null,
          rejectedBy: c.rejectedBy || c.rejected_by || null,
          rejectedAt: c.rejectedAt || c.rejected_at || null
        }))
      });

      // Move the PSC back to DO phase so the originator can add next CM.
      // Server generic PSC update accepts ticket_stage and status fields.
      await axios.put(`/api/psc/${selected.id}`, {
        status: 'Work in Progress',
        ticket_stage: 'Do'
      });

      // refresh UI
      await fetchPscs();
      const res = await axios.get(`/api/psc/${selected.id}`);
      setSelected(res.data);
      setShowForm(false);
      setShowPreview(true);
      alert('Countermeasure rejected and PSC moved back to DO for next corrective action.');
    } catch (err) {
      console.error('handleReject failed:', err);
      alert('Failed to reject countermeasure. See console for details.');
    }
  };

  // Default Table/List view (card-style with search)
  // Show PSCs that have a pending CM (i.e. awaiting Effect Check)
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
    // only include PSCs where there's a pending countermeasure to check
    return matchesSearch ;
  });

  const PreviewView = () => {
    if (!selected) return null;
    return (
      <PSCFullView
        psc={selected}
        onClose={() => { setShowPreview(false); setSelected(null); }}
        actions={
          <div>
            <button className='btn btn-primary mr-2' onClick={() => { setAcceptFormVisible(true); setShowPreview(false); }}>
              Accept Latest CM
            </button>
            <button className='btn btn-warning mr-2' onClick={() => { setShowForm(true); setShowPreview(false); }}>
              Reject Latest CM (Add Remarks)
            </button>
          </div>
        }
      />
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

  // Accept form UI: describes where acceptance text is stored
  const AcceptForm = () => {
    if (!selected || !acceptFormVisible) return null;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const localDate = `${yyyy}-${mm}-${dd}`;

    const cm = getLatestPendingCM(selected);

    return (
      <div className='card full-height'>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <h4>Effectiveness Acceptance - {selected.problem_number}</h4>

          {/* Display the CM being accepted */}
          <div className='form-group'>
            <label>Countermeasure being accepted (read-only)</label>
            <textarea className='form-control' rows={3} value={cm?.countermeasure || ''} readOnly />
          </div>

          <div className='form-group'>
            <label>Effectiveness Checked</label>
            <input className='form-control' name='effectiveness_checked' value={'Accepted'} readOnly />
          </div>

          <div className='form-group'>
            <label>Date</label>
            <input className='form-control' value={localDate} readOnly />
          </div>

          <div className='form-group'>
            <label>Acceptance Description</label>
            <textarea
              className='form-control'
              placeholder='Describe why the countermeasure is effective. (Stored in effectiveness_check.checked_remarks)'
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              disabled={!canEdit}
            />
          </div>

          <div className='text-muted small'>
            Note: On Save the CM will be marked "Accepted" (countermeasure.status = "Accepted", countermeasure.accepted_by/accepted_at stored)
            and an effectiveness_check record will be created/updated (checked_remarks holds this Acceptance Description). The PSC will be moved to Action/Completed accordingly.
          </div>
        </div>

        <div className="fixed-card-footer text-right p-3 border-top bg-white">
          <button className='btn btn-secondary mr-2' onClick={() => { setAcceptFormVisible(false); setShowPreview(true); }}>Cancel</button>
          <button className='btn btn-primary' onClick={handleAccept} disabled={!canEdit}>Save Accept</button>
        </div>
      </div>
    );
  };

  // Reject form UI: describes where rejection text is stored
  const RejectForm = () => {
    if (!selected || !showForm) return null;
    const cm = getLatestPendingCM(selected);

    return (
      <div className='card full-height'>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <h4>Reject Countermeasure - {selected.problem_number}</h4>
          <div className='form-group'>
            <label>Countermeasure being rejected (read-only)</label>
            <textarea className='form-control' rows={3} value={cm?.countermeasure || ''} readOnly />
          </div>

          <div className='form-group'>
            <label>Rejection Reason</label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className='form-control'
              placeholder='Describe why this countermeasure was rejected. (Stored as countermeasure.rejection_reason)'
              rows={6}
              disabled={!canEdit}
            />
          </div>

          <div className='text-muted small'>
            Note: On Submit the CM will be marked "Rejected" and rejection metadata (rejection_reason, rejected_by, rejected_at) will be stored on that countermeasure.
            The PSC ticket will be moved back to "Do" (Work in Progress) so the originator can add the next countermeasure (CM #2) in the Root Cause component.
          </div>
        </div>

        <div className="fixed-card-footer text-right p-3 border-top bg-white">
          <button className='btn btn-secondary mr-2' onClick={() => { setShowForm(false); setShowPreview(true); }}>Cancel</button>
          <button className='btn btn-primary' onClick={handleReject} disabled={!canEdit}>Submit Reject</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {!showPreview && !showForm && !acceptFormVisible && <TableView />}
      {showPreview && <PreviewView />}
      {acceptFormVisible && <AcceptForm />}
      {showForm && <RejectForm />}
    </div>
  );
}