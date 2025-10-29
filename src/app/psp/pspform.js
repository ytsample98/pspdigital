import React, { Component } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import '../../assets/styles/components/_overlay.scss';

// PSC (Problem Solving Card) form page - replaces customer form
class PSCPage extends Component {
  state = {
    pscs: [],
    showForm: false,
    showPreview: false,
    previewTab: 'showAll',
    overlaySearch: '',
    overlayType: '',
    editingId: null,
    activeTab: 'corrective',
    // master lists
    departments: [],
    valuestreams: [],
    lines: [],
    formData: this.getEmptyForm()
  };

  getEmptyForm() {
    const today = new Date().toISOString().split('T')[0];
    return {
      problemNumber: '',
      initiatorName: '',
      date: today,
      shift: '',
      valueStreamLine: 'VL 1',
      ticketStage: 'plan',
      shortDescription: '',
      problemDescription: '',
      problemImage: '', // base64 data url
      qtyAffected: '',
      partAffected: '',
      supplier: '',
      status: 'Open',

      // effectiveness section
      effectivenessChecked: '',
      effectivenessDate: '',
      effectivenessShift: 'A',
      escalationLevel2: false,
      escalationLevel3: false,
      escalationLevel4: false,

      // corrective actions - array of rows
        // single corrective action (only one row allowed)
        correctiveAction: { initialContainmentAction: '', assignToDept: '', targetDate: '', type: '', remarks: '', action: 'accept' },

  // root cause
      symptom: '',
      problem_method: '',
      problem_material: '',
      problem_environment: '',
      problem_man: '',
      problem_machine: '',
  // single root-level corrective action row
  rootAction: { initialContainmentAction: '', assignToDept: '', targetDate: '', type: '' },
      actualCause: '',
      flags: {
        safetyIssue: false,
        fiveSPoint: false,
        machineProblem: false,
        qualityConcern: false,
        potentialMachineIssue: false,
        potentialQualityIssue: false,
        improvementIdea: false
      }
    };
  }

  componentDidMount() {
    this.fetchPSCs();
    this.fetchMasters();
  }

  fetchMasters = async () => {
    try {
      const depSnap = await getDocs(collection(db, 'department'));
      const vlSnap = await getDocs(collection(db, 'valuestream'));
      const lineSnap = await getDocs(collection(db, 'line'));
      const departments = depSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const valuestreams = vlSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const lines = lineSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const shiftSnap = await getDocs(collection(db, 'shiftmaster'));
      const shifts = shiftSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.setState({ departments, valuestreams, lines,shifts });
    } catch (err) {
      console.error('fetchMasters error', err);
    }
  };

  fetchPSCs = async () => {
    const snap = await getDocs(collection(db, 'psc'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    this.setState({ pscs: data });
  };

  togglePreview = (item) => {
    this.setState({ formData: { ...item }, showPreview: true, showForm: false, previewTab: 'showAll' });
  };

  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({ showForm: true, editingId: edit.id, activeTab: 'corrective', formData: { ...edit }, showPreview: false });
    } else {
  const num = `PSC-${101 + this.state.pscs.length}`;
  
  // Determine shift automatically
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  let currentShift = '';

  if (this.state.shifts && this.state.shifts.length > 0) {
    this.state.shifts.forEach(shift => {
      const [sH, sM] = shift.startTime.split(':').map(Number);
      const [eH, eM] = shift.endTime.split(':').map(Number);
      const start = sH * 60 + sM;
      const end = eH * 60 + eM;

      // Handle overnight shifts (e.g., 22:00–06:00)
      if ((start <= currentTime && currentTime <= end) ||
          (end < start && (currentTime >= start || currentTime <= end))) {
        currentShift = shift.shiftName;
      }
    });
  }

  this.setState({
    showForm: true,
    editingId: null,
    activeTab: 'corrective',
    showPreview: false,
    formData: {
      ...this.getEmptyForm(),
      problemNumber: num,
      shift: currentShift ,
    }
  });
}

  };

  handleChange = (field, value) => {
    this.setState(prev => ({ formData: { ...prev.formData, [field]: value } }));
  };

  handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.setState(prev => ({ formData: { ...prev.formData, problemImage: ev.target.result } }));
    };
    reader.readAsDataURL(file);
  };

  handleCheckbox = (fieldPath) => {
    this.setState(prev => {
      const fd = { ...prev.formData };
      // support nested flags
      if (fieldPath.indexOf('.') > -1) {
        const [top, sub] = fieldPath.split('.');
        fd[top] = { ...fd[top], [sub]: !fd[top][sub] };
      } else {
        fd[fieldPath] = !fd[fieldPath];
      }
      return { formData: fd };
    });
  };

updateCorrectiveAction = (field, value) => {
  this.setState(prev => {
    const formData = { ...prev.formData };
    if (field === 'targetDate') {
      // compute type based on date difference
      const formDate = new Date(formData.date);
      const target = new Date(value);
      const diff = Math.ceil((target - formDate) / (1000 * 60 * 60 * 24));
      formData.correctiveAction = {
        ...formData.correctiveAction,
        targetDate: value,
        type: diff > 7 ? 'Long Corrective Action' : 'Short Corrective Action'
      };
    } else {
      formData.correctiveAction = {
        ...formData.correctiveAction,
        [field]: value
      };
    }
    return { formData };
  });
};

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData } = this.state;
    if (!formData.problemNumber || !formData.initiatorName) return alert('Problem Number and Initiator Name required');
    // Validate root cause mandatory fields (method, material, machine) - requirement: three mandatory
    if (!(formData.problem_method && formData.problem_material && formData.problem_machine)) {
      // only enforce if root tab active or any root fields filled
      const anyRoot = formData.problem_method || formData.problem_material || formData.problem_environment || formData.problem_man || formData.problem_machine;
      if (anyRoot) return alert('Please fill Method, Material and Machine fields in Root Cause (three mandatory)');
    }
    if (editingId) {
      await setDoc(doc(db, 'psc', editingId), formData);
    } else {
      await addDoc(collection(db, 'psc'), formData);
    }
    this.setState({ showForm: false, showPreview: false, editingId: null });
    this.fetchPSCs();
  };

  handleDelete = async (id) => {
    if (!window.confirm('Delete this PSC?')) return;
    await deleteDoc(doc(db, 'psc', id));
    this.fetchPSCs();
  };

  renderForm = () => {
    const { formData, activeTab } = this.state;
    return (
      <div className="card full-height" style={{ height: '100vh' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <h4 className="mb-3">PSC - Problem Solving Card</h4>
          <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
            {/* PSC Tab fields */}
            <div className="form-row">
              <div className="form-group col-md-2">
                <label>Problem Number</label>
                <input className="form-control form-control-sm" value={formData.problemNumber} readOnly />
              </div>
              <div className="form-group col-md-3">
                <label>Initiator Name</label>
                <input className="form-control form-control-sm" value={formData.initiatorName} onChange={e => this.handleChange('initiatorName', e.target.value)} />
              </div>
              <div className="form-group col-md-2">
                <label>Date</label>
                <input className="form-control form-control-sm" type="date" value={formData.date} onChange={e => this.handleChange('date', e.target.value)} />
              </div>
              <div className="form-group col-md-1">
  <label>Shift</label>
  <input
    className="form-control form-control-sm"
    value={formData.shift}
    readOnly
  />
</div>

  <div className="form-group col-md-2">
    <label>Value Stream</label>
    <select className="form-control form-control-sm" value={formData.valueStreamLine} onChange={e => this.handleChange('valueStreamLine', e.target.value)}>
      <option value="">Select VL</option>
      {this.state.valuestreams.map(v => <option key={v.id} value={v.vlCode || v.vlName}>{v.vlName || v.vlCode}</option>)}
    </select>
  </div>
  <div className="form-group col-md-2">
    <label>Line</label>
    <select className="form-control form-control-sm" value={formData.lineCode} onChange={e => this.handleChange('lineCode', e.target.value)}>
      <option value="">Select Line</option>
      {this.state.lines.filter(l => !formData.valueStreamLine || l.vlCode === formData.valueStreamLine)
        .map(l => <option key={l.id} value={l.lineCode || l.line_name}>{l.line_name || l.lineCode}</option>)}
    </select>
  </div>

              
            </div>

            <div className="form-row">
              <div className="form-group col-md-6">
                <label>Short Description</label>
                <input className="form-control form-control-sm" value={formData.shortDescription} onChange={e => this.handleChange('shortDescription', e.target.value)} />
              </div>
              <div className="form-group col-md-3">
                <label>Qty Affected</label>
                <input className="form-control form-control-sm" value={formData.qtyAffected} onChange={e => this.handleChange('qtyAffected', e.target.value)} />
              </div>
              <div className="form-group col-md-2">
                <label>Ticket Stage</label>
                <select className="form-control form-control-sm" value={formData.ticketStage} onChange={e => this.handleChange('ticketStage', e.target.value)}>
                  {['Plan', 'Do', 'Check', 'Act'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group col-md-8">
                <label>Problem Description</label>
                <textarea className="form-control form-control-sm" rows={4} value={formData.problemDescription} onChange={e => this.handleChange('problemDescription', e.target.value)} />
              </div>
              <div className="form-group col-md-4">
                <label>Problem Image</label>
                <input type="file" accept="image/*" className="form-control form-control-sm" onChange={this.handleFileChange} />
                {formData.problemImage && <img src={formData.problemImage} alt="problem" style={{ maxWidth: '100%', marginTop: 8 }} />}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group col-md-4"><label>Part Affected</label><input className="form-control form-control-sm" value={formData.partAffected} onChange={e => this.handleChange('partAffected', e.target.value)} /></div>
              <div className="form-group col-md-4"><label>Supplier</label><input className="form-control form-control-sm" value={formData.supplier} onChange={e => this.handleChange('supplier', e.target.value)} /></div>
              <div className="form-group col-md-4"><label>Status</label><input className="form-control form-control-sm" value={formData.status} onChange={e => this.handleChange('status', e.target.value)} /></div>
            </div>

            {/* Tabs: PSC / Corrective / Root Cause */}
            <ul className="nav nav-tabs mt-3" role="tablist">
              <li className="nav-item"><button type="button" className={`nav-link ${activeTab === 'corrective' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'corrective' })}>Corrective Actions</button></li>
              <li className="nav-item"><button type="button" className={`nav-link ${activeTab === 'root' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'root' })}>Root Cause</button></li>
              <li className="nav-item"><button type="button" className={`nav-link ${activeTab === 'psc' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'psc' })}>Effectiveness Check</button></li>
            </ul>

            {activeTab === 'psc' && (
              <div className="mt-3">
                <h5>Effectiveness</h5>
                <div className="form-row">
                  <div className="form-group col-md-3"><label>Effectiveness Checked</label><input className="form-control form-control-sm" value={formData.effectivenessChecked} onChange={e => this.handleChange('effectivenessChecked', e.target.value)} /></div>
                  <div className="form-group col-md-3"><label>Date</label><input type="date" className="form-control form-control-sm" value={formData.effectivenessDate} onChange={e => this.handleChange('effectivenessDate', e.target.value)} /></div>
                  <div className="form-group col-md-2"><label>Shift</label><select className="form-control form-control-sm" value={formData.effectivenessShift} onChange={e => this.handleChange('effectivenessShift', e.target.value)}>{['A','B','C'].map(s=> <option key={s}>{s}</option>)}</select></div>
                  
                </div>
              </div>
            )}

            {activeTab === 'corrective' && (
  <div className="mt-3">
    <div className="form-row">
      <div className="form-group col-md-4">
        <label>Initial Containment Action</label>
        <textarea 
          className="form-control form-control-sm" 
          rows={3} 
          value={formData.correctiveAction.initialContainmentAction} 
          onChange={e => this.updateCorrectiveAction('initialContainmentAction', e.target.value)} 
        />
      </div>
      <div className="form-group col-md-3">
        <label>Assign To (Dept)</label>
        <select 
          className="form-control form-control-sm" 
          value={formData.correctiveAction.assignToDept} 
          onChange={e => this.updateCorrectiveAction('assignToDept', e.target.value)}
        >
          <option value="">Select Dept</option>
          {this.state.departments.map(d => <option key={d.id} value={d.deptCode || d.deptName}>{d.deptName || d.deptCode}</option>)}
        </select>
      </div>
      <div className="form-group col-md-3">
        <label>Target Date</label>
        <input 
          type="date" 
          className="form-control form-control-sm" 
          value={formData.correctiveAction.targetDate} 
          onChange={e => this.updateCorrectiveAction('targetDate', e.target.value)} 
        />
      </div>
      <div className="form-group col-md-2">
        <label>Type</label>
        <input className="form-control form-control-sm" value={formData.correctiveAction.type} readOnly />
      </div>
    </div>
      
    </div>
)}
{activeTab === 'root' && (
  <div className="mt-3">
    <h5>Root Cause Analysis</h5>
    {/* 5-Why fields in two rows */}
    <div className="form-row">
      <div className="form-group col-md-4">
        <label>Why? (1) <span class="required-asterisk">*</span></label>
        <textarea className="form-control form-control-sm" rows={2} value={formData.problem_method} onChange={e => this.handleChange('problem_method', e.target.value)} />
      </div>
      <div className="form-group col-md-4">
        <label>Why? (2) <span class="required-asterisk">*</span></label>
        <textarea className="form-control form-control-sm" rows={2} value={formData.problem_material} onChange={e => this.handleChange('problem_material', e.target.value)} />
      </div>
      <div className="form-group col-md-4">
        <label>Why? (3) <span class="required-asterisk">*</span></label>
        <textarea className="form-control form-control-sm" rows={2} value={formData.problem_environment} onChange={e => this.handleChange('problem_environment', e.target.value)} />
      </div>
    </div>
    <div className="form-row">
      <div className="form-group col-md-6">
        <label>Why? (4)</label>
        <textarea className="form-control form-control-sm" rows={2} value={formData.problem_man} onChange={e => this.handleChange('problem_man', e.target.value)} />
      </div>
      <div className="form-group col-md-6">
        <label>Why? (5)</label>
        <textarea className="form-control form-control-sm" rows={2} value={formData.problem_machine} onChange={e => this.handleChange('problem_machine', e.target.value)} />
      </div>
    </div>
<div className="mt-4">
  <h6>Action Taken</h6>
  <button
    type="button"
    className="btn btn-sm btn-warning mb-2"
    onClick={() => this.setState(prev => ({
      rootReassignMode: !prev.rootReassignMode
    }))}
  >
    {this.state.rootReassignMode ? 'Cancel Reassign' : 'Reassign'}
  </button>
  <table className="table table-bordered table-sm">
    <thead>
      <tr>
        {this.state.rootReassignMode ? (
          <>
            <th>Remarks</th>
            <th>Assign To</th>
          </>
        ) : (
          <>
            <th>Action</th>
            <th>Target Date</th>
            <th>Remarks</th>
          </>
        )}
      </tr>
    </thead>
    <tbody>
      <tr>
        {this.state.rootReassignMode ? (
          <>
            <td>
              <input
                className="form-control form-control-sm"
                value={formData.rootAction.remarks || ''}
                onChange={e => {
                  const value = e.target.value;
                  this.setState(prev => ({
                    formData: {
                      ...prev.formData,
                      rootAction: {
                        ...prev.formData.rootAction,
                        remarks: value
                      }
                    }
                  }));
                }}
              />
            </td>
            <td>
              <select
                className="form-control form-control-sm"
                value={formData.rootAction.assignToDept || ''}
                onChange={e => {
                  const value = e.target.value;
                  this.setState(prev => ({
                    formData: {
                      ...prev.formData,
                      rootAction: {
                        ...prev.formData.rootAction,
                        assignToDept: value
                      }
                    }
                  }));
                }}
              >
                <option value="">Select Dept</option>
                {this.state.departments.map(d => (
                  <option key={d.id} value={d.deptCode || d.deptName}>
                    {d.deptName || d.deptCode}
                  </option>
                ))}
              </select>
            </td>
          </>
        ) : (
          <>
            <td>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                value={formData.rootAction.actionTaken || ''}
                onChange={e => {
                  const value = e.target.value;
                  this.setState(prev => ({
                    formData: {
                      ...prev.formData,
                      rootAction: {
                        ...prev.formData.rootAction,
                        actionTaken: value
                      }
                    }
                  }));
                }}
              />
            </td>
            <td>
              <input
                type="date"
                className="form-control form-control-sm"
                value={formData.rootAction.targetDate || ''}
                onChange={e => {
                  const value = e.target.value;
                  const formDate = new Date(this.state.formData.date);
                  const target = new Date(value);
                  const diff = Math.ceil(
                    (target - formDate) / (1000 * 60 * 60 * 24)
                  );
                  this.setState(prev => ({
                    formData: {
                      ...prev.formData,
                      rootAction: {
                        ...prev.formData.rootAction,
                        targetDate: value,
                        type: diff > 7 ? 'Long Corrective Action' : 'Short Corrective Action'
                      }
                    }
                  }));
                }}
              />
            </td>
            <td>
              <input
                className="form-control form-control-sm"
                value={formData.rootAction.remarks || ''}
                onChange={e => {
                  const value = e.target.value;
                  this.setState(prev => ({
                    formData: {
                      ...prev.formData,
                      rootAction: {
                        ...prev.formData.rootAction,
                        remarks: value
                      }
                    }
                  }));
                }}
              />
            </td>
          </>
        )}
      </tr>
    </tbody>
  </table>
</div>
     <div className="form-row">
                  <div className="form-group col-md-12 d-flex flex-wrap">
                    {[
                      ['flags.safetyIssue', 'Safety issue / Near Miss(es)'],
                      ['flags.fiveSPoint', '5S point'],
                      ['flags.machineProblem', 'Machine problem'],
                      ['flags.qualityConcern', 'Quality concern'],
                      ['flags.potentialMachineIssue', 'Potential machine issue'],
                      ['flags.potentialQualityIssue', 'Potential quality issue'],
                      ['flags.improvementIdea', 'Improvement idea']
                    ].map(([k, label]) => (
                      <div className="form-check mr-3" key={k} style={{ minWidth: 200 }}>
                        <input className="form-check-input" type="checkbox" checked={this.getFlagValue(k)} onChange={() => this.handleCheckbox(k)} id={k} />
                        <label className="form-check-label" htmlFor={k}>{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
  </div>
)}

            <div className="fixed-card-footer">
              <button type="submit" className="btn btn-success btn-sm">Save</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ showForm: false })}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  getFlagValue = (path) => {
    const { formData } = this.state;
    const [top, sub] = path.split('.');
    return formData[top] && formData[top][sub] ? formData[top][sub] : false;
  };

  renderPreview = () => {
    const { formData, previewTab } = this.state;
    const renderRow = (label, value) => (
      <tr>
        <td style={{ width: '30%' }}><strong>{label}</strong></td>
        <td>{value || '-'}</td>
      </tr>
    );

    const renderPSC = () => (
      <table className="table table-bordered table-sm"><tbody>
        {renderRow('Problem Number', formData.problemNumber)}
        {renderRow('Initiator', formData.initiatorName)}
        {renderRow('Date', formData.date)}
        {renderRow('Shift', formData.shift)}
        {renderRow('Value Stream Line', formData.valueStreamLine)}
        {renderRow('Ticket Stage', formData.ticketStage)}
        {renderRow('Short Description', formData.shortDescription)}
        {renderRow('Problem Description', formData.problemDescription)}
        {renderRow('Qty Affected', formData.qtyAffected)}
        {renderRow('Part Affected', formData.partAffected)}
        {renderRow('Supplier', formData.supplier)}
        {renderRow('Status', formData.status)}
      </tbody></table>
    );

    const renderCorrective = () => (
      <table className="table table-bordered table-sm"><tbody>
        {(formData.correctiveActions || []).map((r, i) => (
          <tr key={i}><td style={{ width: '20%' }}>Action {i + 1}</td><td><b>Action:</b> {r.initialContainmentAction || '-'}<br/><b>Assign To:</b> {r.assignTo}<br/><b>Target:</b> {r.targetDate}<br/><b>Type:</b> {r.type}</td></tr>
        ))}
        {(!formData.correctiveActions || formData.correctiveActions.length === 0) && <tr><td colSpan={2} className="text-center">No corrective actions</td></tr>}
      </tbody></table>
    );

    const renderRoot = () => (
      <table className="table table-bordered table-sm"><tbody>
        {renderRow('Symptom', formData.symptom)}
        {renderRow('Problem in Method', formData.problem_method)}
        {renderRow('Problem in Material', formData.problem_material)}
        {renderRow('Problem in Environment', formData.problem_environment)}
        {renderRow('Problem in Man', formData.problem_man)}
        {renderRow('Problem in Machine', formData.problem_machine)}
        {renderRow('Actual Cause', formData.actualCause)}
        {renderRow('Flags', Object.entries(formData.flags || {}).filter(([k,v])=>v).map(([k])=>k).join(', '))}
      </tbody></table>
    );

    const tabContent = () => {
      switch (previewTab) {
        case 'psc': return renderPSC();
        case 'corrective': return renderCorrective();
        case 'root': return renderRoot();
        case 'showAll':
        default:
          return <>{renderPSC()}<hr/>{renderCorrective()}<hr/>{renderRoot()}</>;
      }
    };

    return (
      <div className="card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">PSC Preview</h4>
          <div>
            <button className="btn btn-outline-primary btn-sm mr-2" onClick={() => this.toggleForm(formData)}>View / Edit</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => this.setState({ showPreview: false })}>Back to List</button>
          </div>
        </div>

        <table className="table table-bordered table-sm mb-4"><tbody>
          {renderRow('Problem Number', formData.problemNumber)}
          {renderRow('Initiator', formData.initiatorName)}
          {renderRow('Short Description', formData.shortDescription)}
          {renderRow('Status', formData.status)}
        </tbody></table>

        <ul className="nav nav-tabs mb-3">
          {['showAll', 'corrective', 'root','psc'].map(key => (
            <li className="nav-item" key={key}>
              <button className={`nav-link ${this.state.previewTab === key ? 'active' : ''}`} onClick={() => this.setState({ previewTab: key })}>
                {key === 'showAll' ? 'Show All' : (key.charAt(0).toUpperCase() + key.slice(1))}
              </button>
            </li>
          ))}
        </ul>

        <div className="tab-content">{tabContent()}</div>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">PSC List</h4>
          <div>
            <button className="btn btn-primary btn-sm mr-2" onClick={() => this.toggleForm()}>+ Add PSC</button>
          </div>
        </div>
        <div className="custom-table-responsive">
          <table className="table table-bordered table-sm">
            <thead className='thead-light'>
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
              {this.state.pscs.map((c, i) => (
                <tr key={c.id}>
                  <td><button className='btn btn-link p-0' onClick={() => this.togglePreview(c)}>{c.problemNumber}</button></td>
                  <td>{c.initiatorName}</td>
                  <td>{c.date}</td>
                  <td>{c.shift}</td>
                  <td>{c.valueStreamLine}</td>
                  <td>{c.ticketStage}</td>
                  <td>{c.shortDescription}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
              {this.state.pscs.length === 0 && <tr><td colSpan="9" className="text-center">No records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  render = () => {
    return (
      <div className="container-fluid">
        {this.state.showForm
          ? this.renderForm()
          : this.state.showPreview
            ? this.renderPreview()
            : this.renderTable()}
      </div>
    );
  };
}

export default PSCPage;