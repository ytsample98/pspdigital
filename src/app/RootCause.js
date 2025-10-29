import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PSCFullView from './PSCFullView';
import { loadEscalations, computeEscalationForPsc, isFieldEditable } from './pscPermissions';
import { useCanEdit  } from './canEdit';
import { Tabs, Tab } from 'react-bootstrap';

export default function RootCause() {
  const [pscs, setPscs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [root, setRoot] = useState({
    symptom: '',
    why1: '',
    why2: '',
    why3: '',
    why4: '',
    why5: '',
    remarks: '',
    // countermeasures: start as an empty array (do not create a "hidden" blank entry)
    countermeasures: []
  });
  const [reassign, setReassign] = useState({ countMeasure: '', targetDate: '', type: '', remarks: '', assignTo: '' });
  const [showReassignSimple, setShowReassignSimple] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const canEdit = useCanEdit(selected, activeEsc);

  useEffect(() => {
    fetchPscs();
    fetchDepartments();
    try {
      const op = localStorage.getItem('openPsc');
      if (op) {
        const p = JSON.parse(op);
        setSelected(p);
        setShowPreview(true);
        localStorage.removeItem('openPsc');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadEscalations().then(list => setEscalations(list));
  }, []);

  useEffect(() => {
    if (selected && escalations.length) {
      setActiveEsc(computeEscalationForPsc(selected, escalations));
    } else setActiveEsc(null);
  }, [selected, escalations]);

  // load root cause from selected PSC into local state
  useEffect(() => {
    if (selected && selected.root_cause) {
      const rc = selected.root_cause;
      setRoot(prev => ({
        ...prev,
        why1: rc.why1 ?? rc.why_1 ?? '',
        why2: rc.why2 ?? rc.why_2 ?? '',
        why3: rc.why3 ?? rc.why_3 ?? '',
        why4: rc.why4 ?? rc.why_4 ?? '',
        why5: rc.why5 ?? rc.why_5 ?? '',
        symptom: rc.symptom ?? '',
        // set countermeasures to the array from backend or empty array.
        // DO NOT force a single "blank" entry here; use empty array so the UI can show a proper form
        countermeasures: Array.isArray(rc.countermeasures) ? rc.countermeasures : []
      }));
    } else if (!selected) {
      // reset when no PSC selected
      setRoot(prev => ({ ...prev, symptom: '', why1: '', why2: '', why3: '', why4: '', why5: '', remarks: '', countermeasures: [] }));
    }
  }, [selected, showForm]);

  const fetchPscs = async () => {
    try {
      const res = await axios.get('/api/psc');
      setPscs(res.data || []);
    } catch (e) {
      console.warn('fetch pscs failed', e);
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

  const handleSelect = (psc) => {
    setSelected(psc);
    setShowPreview(true);
    setShowForm(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRoot((prev) => {
      const next = { ...prev, [name]: value };
      // keep legacy single-field behavior for compatibility (not used when using countermeasures array)
      if (name === 'counter_targetDate') {
        try {
          const diff = (new Date(value) - new Date()) / (1000 * 60 * 60 * 24);
          next.counter_type = diff > 7 ? 'long corrective action' : 'short corrective action';
        } catch (err) {
          next.counter_type = '';
        }
      }
      return next;
    });
  };

  // Make countermeasure change robust for empty arrays and negative index usage.
  const handleCountermeasureChange = (index, field, value) => {
    setRoot((prev) => {
      const cms = Array.isArray(prev.countermeasures) ? prev.countermeasures.map(c => ({ ...c })) : [];
      // if index is out of bounds (e.g. -1 when array empty), treat it as index 0 and ensure an object exists
      const safeIndex = (typeof index === 'number' && index >= 0) ? index : 0;
      while (cms.length <= safeIndex) {
        cms.push({ countermeasure: '', targetDate: '', type: '', actionRemarks: '', assignTo: '', comments: '', date: '', status: 'Pending' });
      }
      const cm = { ...cms[safeIndex] };
      cm[field] = value;
      if (field === 'targetDate') {
        try {
          const diff = (new Date(value) - new Date()) / (1000 * 60 * 60 * 24);
          cm.type = diff > 7 ? 'long corrective action' : 'short corrective action';
        } catch (err) {
          cm.type = '';
        }
      }
      cms[safeIndex] = cm;
      return { ...prev, countermeasures: cms };
    });
  };

  // Allow adding new countermeasure rows. Do not block based on the "status" of previous row.
  // However avoid creating multiple empty rows if the last row is still empty.
  const addCountermeasureRow = () => {
    setRoot(prev => {
      const cms = Array.isArray(prev.countermeasures) ? prev.countermeasures.map(c => ({ ...c })) : [];
      const last = cms[cms.length - 1];
      if (last && !(last.countermeasure || '').toString().trim()) {
        // there's an existing blank row — focus the user to fill it instead of pushing another blank
        alert('Please fill the current countermeasure before adding a new one.');
        return prev;
      }
      cms.push({
        countermeasure: '',
        targetDate: '',
        type: '',
        actionRemarks: '',
        assignTo: '',
        comments: '',
        date: '',
        status: 'Pending'
      });
      return { ...prev, countermeasures: cms };
    });
  };

  const removeCountermeasureRow = (index) => {
    setRoot((prev) => {
      const cms = (prev.countermeasures || []).map((c) => ({ ...c }));
      cms.splice(index, 1);
      return { ...prev, countermeasures: cms };
    });
  };

  const handleReassignChange = (e) => {
    const { name, value } = e.target;
    setReassign((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'targetDate') {
        try {
          const diff = (new Date(value) - new Date()) / (1000 * 60 * 60 * 24);
          next.type = diff > 7 ? 'long corrective action' : 'short corrective action';
        } catch (err) {
          next.type = '';
        }
      }
      return next;
    });
  };

  const submitRoot = async (e) => {
    e.preventDefault();
    if (!selected) return;

    if (!root.why1 || !root.why2 || !root.why3) {
      alert('Why 1, Why 2 and Why 3 are required before submitting root cause.');
      return;
    }

    const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');

    // Only include countermeasures that have a non-empty description
    const validCMs = (root.countermeasures || []).filter(cm => cm.countermeasure && cm.countermeasure.toString().trim());

    const payload = {
      why1: root.why1,
      why2: root.why2,
      why3: root.why3,
      why4: root.why4,
      why5: root.why5,
      filled_by: user.id,
      countermeasures: validCMs.map(cm => ({
        countermeasure: cm.countermeasure,
        targetDate: cm.targetDate,
        type: cm.type,
        actionRemarks: cm.actionRemarks,
        assignTo: cm.assignTo ? Number(cm.assignTo) : null,
        comments: cm.comments,
        status: cm.status || 'Pending',
        acceptedBy: cm.acceptedBy || null,
        acceptedAt: cm.acceptedAt || null,
        rejectionReason: cm.rejectionReason || null,
        rejectedBy: cm.rejectedBy || null,
        rejectedAt: cm.rejectedAt || null
      }))
    };

    console.log('Submitting root cause payload:', payload);

    try {
      await axios.put(`/api/psc/${selected.id}/rootcause`, payload);
      // refresh and close
      setSelected(null);
      setShowForm(false);
      setShowPreview(false);
      fetchPscs();
    } catch (err) {
      console.error('Failed to submit root cause', err);
      alert('Failed to save root cause. See console for details.');
    }
  };

  const submitReassign = async () => {
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
  };

  const filtered = pscs.filter((p) => {
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
  });

  const TableView = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Root Cause Analysis</h4>
          <div style={{ width: '40%' }} className="d-flex">
            <input className="form-control" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                <th>Short Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((psc) => (
                <tr key={psc.id}>
                  <td>
                    <button className="btn btn-link p-0" onClick={() => handleSelect(psc)}>{psc.problemNumber || psc.problem_number}</button>
                  </td>
                  <td>{psc.initiatorName || psc.initiator_name}</td>
                  <td>{psc.date ? new Date(psc.date).toLocaleDateString('en-CA') : ''}</td>
                  <td>{psc.shift}</td>
                  <td>{psc.valueStreamLine || psc.value_stream_line || psc.valueStream || psc.value_stream}</td>
                  <td>{psc.ticketStage || psc.ticket_stage}</td>
                  <td>{psc.shortDescription || psc.short_description}</td>
                  <td>{psc.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const PreviewView = () => {
    if (!selected) return null;
    // Only show Add Root Cause if user is in assigned department and stage is 'check'
   const assignedDept = selected.corrective_action?.corrective_assign_to
    || selected.correctiveAction?.corrective_assign_to
    || selected.corrective_assign_to
    || '';
    const user = (() => { try { return JSON.parse(localStorage.getItem('dcmsUser')); } catch(e){return null;} })();
    const userDept = user?.dept_id || user?.department || user?.dept_name || user?.dept_name || '';
    console.log('User Dept:', userDept, 'Assigned Dept:', assignedDept);
    const stage = (selected.ticket_stage || selected.ticketStage || '');
    const hasAcceptedCM = selected.root_cause?.countermeasures?.some(cm => cm.status === 'Accepted');
    const canShowForm = !hasAcceptedCM; // Show button until any CM is accepted
    return (
      <PSCFullView
        psc={selected}
        onClose={() => {
          setShowPreview(false);
          setSelected(null);
        }}
        actions={canShowForm ? (
          <div>
            <button className="btn btn-primary mr-2" onClick={() => { setShowForm(true); setShowPreview(false); }}>Add Root Cause</button>
          </div>
        ) : null}
      />
    );
  };

  const FormView = () => {
    if (!selected) return null;

    const disableRootFields = !!selected.root_cause;
    const countermeasures = root.countermeasures || [];
    const lastIndex = countermeasures.length ? countermeasures.length - 1 : 0;
    const defaultCM = {
      countermeasure: '',
      targetDate: '',
      type: '',
      comments: '',
      actionRemarks: '',
      assignTo: '',
      status: 'Pending'
    };
    const latestCM = countermeasures[lastIndex] || defaultCM;

    // Make countermeasure form available at all times (so user can add when none exist)
    const showCMForm = true;

    return (
      <div className="card full-height">
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <h4>PSC: {selected.problem_number || selected.problemNumber}</h4>
          <div className="mb-2">
            <strong>Short Desc:</strong> {selected.short_description || selected.shortDescription}
          </div>

          <Tabs defaultActiveKey="root" className="mb-3">
            <Tab eventKey="root" title="Root Cause Analysis">
              <form onSubmit={submitRoot}>
                <div className="form-group">
                  <label>Symptom</label>
                  <input
                    name="symptom"
                    value={root.symptom || ''}
                    onChange={handleChange}
                    className="form-control"
                    disabled={disableRootFields}
                  />
                </div>

                <div className="form-row">
                  {[1,2,3,4,5].map(i => (
                    <div className="form-group col-md-4" key={i}>
                      <label>Why {i} {i <= 3 && <span style={{color:'red'}}>*</span>}</label>
                      <textarea
                        name={`why${i}`}
                        value={root[`why${i}`] || ''}
                        onChange={handleChange}
                        className="form-control"
                        rows={4}
                        disabled={disableRootFields}
                      />
                    </div>
                  ))}
                </div>

                <div className="fixed-card-footer text-right p-3 border-top bg-white">
                  <button
                    type="button"
                    className="btn btn-secondary mr-2"
                    onClick={() => { setShowForm(false); setShowPreview(true); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary ml-2" disabled={disableRootFields}>
                    Finalize Root Cause
                  </button>
                </div>
              </form>
            </Tab>

            <Tab eventKey="cm" title="Countermeasure & Effect Check">
              <h5><b>Countermeasure History</b></h5>
              <div className="table-responsive mb-3">
                <table className="table table-bordered">
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
                    {countermeasures.length ? countermeasures.map((cm, idx) => (
                      <tr key={idx}>
                        <td>{cm.countermeasure}</td>
                        <td>{cm.targetDate}</td>
                        <td>{cm.type}</td>
                        <td>{cm.comments}</td>
                        <td>{cm.status}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="text-center">No countermeasures yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {showCMForm && (
                <div className="border p-3">
                  <h5><b>{countermeasures.length ? 'Edit / Add Countermeasure' : 'Add New Countermeasure'}</b></h5>

                  <label>Description</label>
                  <textarea
                    className="form-control"
                    value={latestCM?.countermeasure || ''}
                    onChange={(e) => handleCountermeasureChange(lastIndex, 'countermeasure', e.target.value)}
                    rows={3}
                  />

                  <label className="mt-2">Target Date</label>
                  <input
                    type="date"
                    value={latestCM?.targetDate || ''}
                    onChange={(e) => handleCountermeasureChange(lastIndex, 'targetDate', e.target.value)}
                    className="form-control"
                  />

                  <label className="mt-2">Type</label>
                  <input className="form-control" value={latestCM?.type || ''} readOnly />

                  <label className="mt-2">Comments</label>
                  <textarea
                    className="form-control"
                    value={latestCM?.comments || ''}
                    onChange={(e) => handleCountermeasureChange(lastIndex, 'comments', e.target.value)}
                    rows={2}
                  />

                  <div className="mt-3">
                    <button type="button" className="btn btn-success btn-sm mr-2" onClick={addCountermeasureRow}>
                      + Add Countermeasure Row
                    </button>
                    {countermeasures.length > 0 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeCountermeasureRow(lastIndex)}>
                        Remove Last Row
                      </button>
                    )}
                    <small className="form-text text-muted mt-2">
                      Note: Click "Finalize Root Cause" to save root cause and any countermeasures with a description.
                    </small>
                  </div>
                </div>
              )}
            </Tab>
          </Tabs>
        </div>
      </div>
    );
  };

  return (
    <div>
      {!showPreview && !showForm && <TableView />}
      {showPreview && <PreviewView />}
      {showForm && <FormView />}
    </div>
  );
}