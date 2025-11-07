import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PSCFullView from './PSCFullView';
import CommentDialog from './CommentDialog'; // placeholder — user said they'll provide / prompt later
import { loadEscalations, computeEscalationForPsc } from './pscPermissions';
import { useCanEdit } from './canEdit';
import { Tabs, Tab } from 'react-bootstrap';

export default function RootCause() {
  const [pscs, setPscs] = useState([]);
  const [text, setText] = useState('');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);

  // root cause draft/final structure
  const [root, setRoot] = useState({
    symptom: '',
    finalCause: '', // new required field per spec
    why1: '',
    why2: '',
    why3: '',
    why4: '',
    why5: '',
    countermeasures: []
  });
const [form, setForm] = useState({
    description: "",
    date: "",
    address: ""
  });
  // Reassign state kept from original file for backward compatibility
  const [reassign, setReassign] = useState({remarks: '', assignTo: '' });
  const [showReassignSimple, setShowReassignSimple] = useState(false);

  // view flags
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // permissions & helpers
  const [departments, setDepartments] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [activeEsc, setActiveEsc] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const canEdit = useCanEdit(selected, activeEsc);

  // NEW: UI state for tab and comment dialog
  const [activeTab, setActiveTab] = useState('root'); // 'root' or 'cm'
  const [showCommentsDialog, setShowCommentsDialog] = useState(false);
  const [selectedCMForComments, setSelectedCMForComments] = useState(null); // full countermeasure object
  const [cmHistory, setCmHistory] = useState([]); // full historical log data for selected CM

  useEffect(() => {
    fetchPscs();
    loadEscalations().then(list => setEscalations(list));
  }, []);

  useEffect(() => {
    if (selected) refreshPsc(selected.id);
  }, [selected]);

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
    if (!escalations.length) {
      loadEscalations().then(list => {
        setEscalations(list);
        setActiveEsc(computeEscalationForPsc(psc, list));
      });
    } else {
      setActiveEsc(computeEscalationForPsc(psc, escalations));
    }
  };

  const refreshPsc = async (pscId) => {
    try {
      const res = await axios.get(`/api/psc/${pscId}`);
      if (!res.data) return;
      const joined = res.data;
      if (joined.root_cause) {
        const rc = joined.root_cause;
        setRoot({
          symptom: rc.symptom || '',
          finalCause: rc.final_cause || '',
          why1: rc.why1 || '',
          why2: rc.why2 || '',
          why3: rc.why3 || '',
          why4: rc.why4 || '',
          why5: rc.why5 || '',
          // map canonical CMs
          countermeasures: (rc.countermeasures || []).map(cm => ({
            id: cm.id,
            description: cm.description || cm.countermeasure,
            targetDate: cm.targetDate || cm.target_date || null,
            type: cm.type || '',
            cm_status: cm.cm_status || cm.status || 'Pending',
            createdBy: cm.createdBy || cm.created_by || null,
            createdAt: cm.createdAt || cm.created_at || null
          }))
        });
        // If root cause exists, automatically open CM tab when opening form
        setActiveTab('cm');
      } else {
        // no root cause -> show root tab
        setRoot(prev => ({ ...prev, countermeasures: prev.countermeasures || [] }));
        setActiveTab('root');
      }
    } catch (err) {
      console.warn('refreshPsc failed', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRoot(prev => ({ ...prev, [name]: value }));
  };

  // only a single input area for adding CM (the UI keeps last row as input)
  const handleCountermeasureChange = (field, value) => {
    setRoot(prev => {
      const cms = Array.isArray(prev.countermeasures) ? prev.countermeasures.map(c => ({ ...c })) : [];
      const idx = cms.length ? cms.length - 1 : 0;
      while (cms.length <= idx) {
        cms.push({ id: null, description: '', targetDate: '', type: '', cm_status: 'Pending' });
      }
      cms[idx][field] = value;
      if (field === 'targetDate') {
        try {
          const diff = (new Date(value) - new Date()) / (1000 * 60 * 60 * 24);
          cms[idx].type = diff > 7 ? 'long corrective action' : 'short corrective action';
        } catch (err) {
          cms[idx].type = '';
        }
      }
      return { ...prev, countermeasures: cms };
    });
    
  };

  const saveRootAndNext = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selected) return;
    if (!root.why1 || !root.why2 || !root.why3) return alert('Why 1, Why 2 and Why 3 are required.');
    if (!root.finalCause || !root.finalCause.toString().trim()) return alert('Final Cause is required.');

    const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
    const cmsToSend = (root.countermeasures || []).filter(cm => (cm.description || '').toString().trim()).map(cm => ({
      description: cm.description,
      targetDate: cm.targetDate,
      type: cm.type,
      created_by: user.id || null
    }));

    const payload = {
      why1: root.why1,
      why2: root.why2,
      why3: root.why3,
      why4: root.why4,
      why5: root.why5,
      final_cause: root.finalCause,
      filled_by: user.id || null,
      countermeasures: cmsToSend
    };

    try {
      await axios.put(`/api/psc/${selected.id}/rootcause`, payload);
      await refreshPsc(selected.id);
      // switch to countermeasure tab
      setActiveTab('cm');
      
    } catch (err) {
      console.error('saveRootAndNext failed', err);
      alert('Failed to save root cause. See console.');
    }
  };

  // Add (save) countermeasure: validates fields and posts to server
  const saveCountermeasure = async () => {
    if (!selected) return;
    // take last (input) cm
    const cms = root.countermeasures || [];
    const last = cms.length ? cms[cms.length - 1] : null;
    if (!last || !(last.description || '').toString().trim()) return alert('Please enter Countermeasure description.');
    // targetDate and type are expected; validate targetDate
    if (!last.targetDate) return alert('Please select Target Date for the countermeasure.');
    const newEntry = {description: last.description, targetDate: last.targetDate, type: last.type}; // if object: {...text} to create a copy
    setRows((prevRows) => [...prevRows, newEntry]);

    const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
    const payload = {
      description: last.description,
      targetDate: last.targetDate,
      type: last.type || '',
      created_by: user.id || null
    };

    try {
      await axios.post(`/api/psc/${selected.id}/countermeasure`, payload);
      // refresh to load canonical CMs and ids
      await refreshPsc(selected.id);
      setText('');
      setRows((prevRows) => [...prevRows, newEntry]);
      setRoot(prev => {
        const updated = (prev.countermeasures || []).map(c => ({ ...c }));
        // push empty if last after refresh is filled
        const lastAfter = updated[updated.length - 1] || {};
        if (lastAfter && (lastAfter.description || '').toString().trim()) {
          updated.push({ id: null, description: '', targetDate: '', type: '', cm_status: 'Pending' });
        }
        return { ...prev, countermeasures: updated };
      });
    } catch (err) {
      console.error('saveCountermeasure failed', err);
      alert('Failed to save countermeasure. See console.');
    }
  };

  // Open comments dialog: fetch countermeasure history from server
  const openCommentsDialog = async (cm) => {
    if (!cm || !cm.id) {
      setSelectedCMForComments(cm);
      setCmHistory([]);
      setShowCommentsDialog(true);
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
  };

  // Submit comment from dialog -> server -> refresh CMs and close dialog
  const submitCommentForSelectedCM = async (commentText) => {
    if (!selectedCMForComments || !selectedCMForComments.id) return alert('Save the countermeasure first.');
    try {
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      await axios.post(`/api/countermeasure/${selectedCMForComments.id}/comment`, {
        comment: commentText,
        logged_by: user.id || null
      });
      // after posting comment, refresh PSC to reflect cm_status change and history
      await refreshPsc(selected.id);
      setShowCommentsDialog(false);
      setSelectedCMForComments(null);
      setCmHistory([]);
    } catch (err) {
      console.error('submitComment failed', err);
      alert('Failed to submit comment.');
    }
  };

  // UI helpers
  const badgeForStatus = (status) => {
    const s = (status || '').toLowerCase();
    const className =
      s === 'accepted' ? 'badge badge-success' :
        s === 'for validation' ? 'badge badge-warning' :
          s === 'rejected' ? 'badge badge-danger' :
            'badge badge-secondary';
    return <span className={className}>{status || 'Pending'}</span>;
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
              {filtered.length > 0 ? (
              filtered.map((psc) => (
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
              ))
            ) : (
              <tr>
              <td colSpan="8" className="text-center">
      <div className="spinner-border text-primary" role="status">
        <span className="sr-only">Loading...</span>
      </div>
      </td>
      </tr>
            )
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const PreviewView = () => {
    if (!selected) return null;
    const assignedDept = selected.corrective_action?.corrective_assign_to
      || selected.correctiveAction?.corrective_assign_to
      || selected.corrective_assign_to
      || '';
    const user = (() => { try { return JSON.parse(localStorage.getItem('dcmsUser')); } catch (e) { return null; } })();
    const userDept = user?.dept_id || user?.department || user?.dept_name || user?.dept_name || '';
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
                        <button className="btn btn-primary mr-2" onClick={() => { setShowForm(true); setShowPreview(false); setActiveTab(selected.root_cause ? 'cm' : 'root'); }}>Add Root Cause</button>

          </div>
        ) : null}
      />
    );
  };

  const FormView = () => {
    if (!selected) return null;
    const disableRootFields = !!selected.root_cause; // when root cause exists, we do not show root tab
    const countermeasures = root.countermeasures || [];
    const lastIdx = countermeasures.length ? countermeasures.length - 1 : 0;
    const latest = countermeasures[lastIdx] || { id: null, description: '', targetDate: '', type: '', cm_status: 'Pending' };

    // If a root cause already exists, only show CM tab per requirement
    const showRootTab = !selected.root_cause;

    return (
      <div className="card full-height">
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
       <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
        <h4>PSC: {selected.problem_number || selected.problemNumber}</h4>
        <div className="mb-2"><strong>Short Desc:</strong> {selected.short_description || selected.shortDescription}</div>
    </div>
    
    <button type="button" className="btn btn-danger" onClick={() => { setShowForm(false); setShowPreview(true); }}>Back</button>
</div>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
            {showRootTab && (
              <Tab eventKey="root" title="Root Cause Analysis">
                <form onSubmit={saveRootAndNext}>
                  <div className="form-group">
                    <label>Symptom</label>
                    <input name="symptom" value={root.symptom || ''} onChange={handleChange} className="form-control" />
                  </div>

                  <div className="form-row">
                    {[1,2,3,4,5].map(i => (
                      <div className="form-group col-md-4" key={i}>
                        <label>Why {i} {i <= 3 && <span style={{color:'red'}}>*</span>}</label>
                        <textarea name={`why${i}`} value={root[`why${i}`] || ''} onChange={handleChange} className="form-control" rows={4} />
                      </div>
                    ))}
                  </div>

                  <div className="form-group">
                    <label>Final Cause <span style={{color:'red'}}>*</span></label>
                    <textarea name="finalCause" value={root.finalCause || ''} onChange={handleChange} className="form-control" rows={3} required />
                  </div>

                  <div className="fixed-card-footer text-right p-3 border-top bg-white">
                   
                    <button type="button" className="btn btn-primary ml-2" onClick={saveRootAndNext}>Save Root Cause & Next</button>
                  </div>
                </form>
              </Tab>
            )}

            <Tab eventKey="cm" title="Countermeasure & Effect Check">
              <h5><b>Countermeasure History</b></h5>
               <div>
                <h5><b>Add Countermeasure</b></h5>
                <div className='form-row'>
                <label>Description</label>
                <textarea className="form-control" value={latest.description || ''} onChange={(e) => handleCountermeasureChange('description', e.target.value)} rows={3} />
                               

                </div>
                <div className='form-row'>
                  <div className='col-md-6'>
                    <label className="mt-2">Target Date</label>
                    <input type="date" className="form-control" value={latest.targetDate || ''} onChange={(e) => handleCountermeasureChange('targetDate', e.target.value)} />
</div>
                  <div className='col-md-6'>
                <label className="mt-2">Type</label>
                <input className="form-control" readOnly value={latest.type || ''} />
</div>
</div>
                <div className="mt-3">
                  {/* Only one "Save Countermeasure" button per requirement */}
                  <button type="button" className="btn btn-primary" onClick={saveCountermeasure}>Save Countermeasure</button>

                  <small className="form-text text-muted mt-2 d-block">Click "Save Countermeasure" to persist to history. Use "Comments" to add/view comments.</small>
                </div>
              </div>

              <div className="table-responsive mb-3">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Target Date</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Comments</th>
                    </tr>
                  </thead>
                 <tbody>
  {countermeasures.filter(cm => cm.id).length ? (
    countermeasures.filter(cm => cm.id).map((cm, idx) => (
      <tr key={cm.id || idx + 1}>
        <td>{cm.description}</td>
        <td>{cm.targetDate}</td>
        <td>{cm.type}</td>
        <td>{badgeForStatus(cm.cm_status)}</td>
        <td>
          <button
            type="button"
            className="btn btn-link p-0"
            onClick={() => openCommentsDialog(cm)}
          >
            Comments
          </button>
        </td>
      </tr>
    ))
  ) : (
    <tr>
      <td colSpan={5} className="text-center">No countermeasures yet</td>
    </tr>
  )}
</tbody>

                </table>
              </div>

             
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