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
    activeTab: 'psc',
    formData: this.getEmptyForm()
  };

  getEmptyForm() {
    const today = new Date().toISOString().split('T')[0];
    return {
      problemNumber: '',
      initiatorName: '',
      date: today,
      shift: 'A',
      valueStreamLine: 'VL 1',
      ticketStage: 'plan',
      shortDescription: '',
      problemDescription: '',
      problemImage: '', // base64 data url
      qtyAffected: '',
      partAffected: '',
      supplier: '',
      status: 'open',

      // effectiveness section
      effectivenessChecked: '',
      effectivenessDate: '',
      effectivenessShift: 'A',
      escalationLevel2: false,
      escalationLevel3: false,
      escalationLevel4: false,

      // corrective actions - array of rows
      correctiveActions: [],

      // root cause
      symptom: '',
      problem_method: '',
      problem_material: '',
      problem_environment: '',
      problem_man: '',
      problem_machine: '',
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
  }

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
      this.setState({ showForm: true, editingId: edit.id, activeTab: 'psc', formData: { ...edit }, showPreview: false });
    } else {
      // generate a problem number
      const num = `PSC-${101 + this.state.pscs.length}`;
      this.setState({ showForm: true, editingId: null, activeTab: 'psc', showPreview: false, formData: { ...this.getEmptyForm(), problemNumber: num } });
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

  // corrective actions helpers
  addCorrectiveRow = () => {
    this.setState(prev => ({ formData: { ...prev.formData, correctiveActions: [...(prev.formData.correctiveActions || []), { initialContainmentAction: '', assignTo: 'tl', targetDate: '', type: '' }] } }));
  };

  updateCorrectiveRow = (idx, field, value) => {
    this.setState(prev => {
      const rows = [...(prev.formData.correctiveActions || [])];
      rows[idx] = { ...rows[idx], [field]: value };
      // compute type based on targetDate compared to form date
      if (field === 'targetDate') {
        const formDate = new Date(prev.formData.date);
        const target = new Date(value);
        const diff = Math.ceil((target - formDate) / (1000 * 60 * 60 * 24));
        rows[idx].type = diff > 7 ? 'Long Corrective Action' : 'Short Corrective Action';
      }
      return { formData: { ...prev.formData, correctiveActions: rows } };
    });
  };

  removeCorrectiveRow = (idx) => {
    this.setState(prev => {
      const rows = [...(prev.formData.correctiveActions || [])];
      rows.splice(idx, 1);
      return { formData: { ...prev.formData, correctiveActions: rows } };
    });
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData } = this.state;
    if (!formData.problemNumber || !formData.initiatorName) return alert('Problem Number and Initiator Name required');
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
                <select className="form-control form-control-sm" value={formData.shift} onChange={e => this.handleChange('shift', e.target.value)}>
                  {['A', 'B', 'C'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group col-md-2">
                <label>Value Stream Line</label>
                <select className="form-control form-control-sm" value={formData.valueStreamLine} onChange={e => this.handleChange('valueStreamLine', e.target.value)}>
                  {['VL 1', 'VL 2', 'VL 3'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-group col-md-2">
                <label>Ticket Stage</label>
                <select className="form-control form-control-sm" value={formData.ticketStage} onChange={e => this.handleChange('ticketStage', e.target.value)}>
                  {['plan', 'do', 'check', 'act'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group col-md-6">
                <label>Short Description</label>
                <input className="form-control form-control-sm" value={formData.shortDescription} onChange={e => this.handleChange('shortDescription', e.target.value)} />
              </div>
              <div className="form-group col-md-6">
                <label>Qty Affected</label>
                <input className="form-control form-control-sm" value={formData.qtyAffected} onChange={e => this.handleChange('qtyAffected', e.target.value)} />
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
              <li className="nav-item"><button type="button" className={`nav-link ${activeTab === 'psc' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'psc' })}>PSC</button></li>
              <li className="nav-item"><button type="button" className={`nav-link ${activeTab === 'corrective' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'corrective' })}>Corrective Actions</button></li>
              <li className="nav-item"><button type="button" className={`nav-link ${activeTab === 'root' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'root' })}>Root Cause</button></li>
            </ul>

            {activeTab === 'psc' && (
              <div className="mt-3">
                <h5>Effectiveness</h5>
                <div className="form-row">
                  <div className="form-group col-md-3"><label>Effectiveness Checked</label><input className="form-control form-control-sm" value={formData.effectivenessChecked} onChange={e => this.handleChange('effectivenessChecked', e.target.value)} /></div>
                  <div className="form-group col-md-3"><label>Date</label><input type="date" className="form-control form-control-sm" value={formData.effectivenessDate} onChange={e => this.handleChange('effectivenessDate', e.target.value)} /></div>
                  <div className="form-group col-md-2"><label>Shift</label><select className="form-control form-control-sm" value={formData.effectivenessShift} onChange={e => this.handleChange('effectivenessShift', e.target.value)}>{['A','B','C'].map(s=> <option key={s}>{s}</option>)}</select></div>
                  <div className="form-group col-md-4 d-flex align-items-center">
                    <div className="form-check mr-3"><input className="form-check-input" type="checkbox" checked={formData.escalationLevel2} onChange={() => this.handleCheckbox('escalationLevel2')} id="esc2" /><label className="form-check-label" htmlFor="esc2">Escalation Level 2</label></div>
                    <div className="form-check mr-3"><input className="form-check-input" type="checkbox" checked={formData.escalationLevel3} onChange={() => this.handleCheckbox('escalationLevel3')} id="esc3" /><label className="form-check-label" htmlFor="esc3">Escalation Level 3</label></div>
                    <div className="form-check"><input className="form-check-input" type="checkbox" checked={formData.escalationLevel4} onChange={() => this.handleCheckbox('escalationLevel4')} id="esc4" /><label className="form-check-label" htmlFor="esc4">Escalation Level 4</label></div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'corrective' && (
              <div className="mt-3">
                <h5>Corrective Actions</h5>
                <div className="mb-2">
                  <button type="button" className="btn btn-sm btn-primary" onClick={this.addCorrectiveRow}>+ Add Action</button>
                </div>
                <table className="table table-bordered table-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Initial Containment Action</th>
                      <th>Assign To</th>
                      <th>Target Date</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.correctiveActions || []).map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><textarea className="form-control form-control-sm" value={r.initialContainmentAction} onChange={e => this.updateCorrectiveRow(i, 'initialContainmentAction', e.target.value)} /></td>
                        <td>
                          <select className="form-control form-control-sm" value={r.assignTo} onChange={e => this.updateCorrectiveRow(i, 'assignTo', e.target.value)}>
                            {['tl', 'vsl', 'plant head'].map(a => <option key={a}>{a}</option>)}
                          </select>
                        </td>
                        <td><input type="date" className="form-control form-control-sm" value={r.targetDate || ''} onChange={e => this.updateCorrectiveRow(i, 'targetDate', e.target.value)} /></td>
                        <td>{r.type || ''}</td>
                        <td><button type="button" className="btn btn-sm btn-danger" onClick={() => this.removeCorrectiveRow(i)}>Delete</button></td>
                      </tr>
                    ))}
                    {(!formData.correctiveActions || formData.correctiveActions.length === 0) && <tr><td colSpan={6} className="text-center">No corrective actions</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'root' && (
              <div className="mt-3">
                <h5>Root Cause Analysis</h5>
                <div className="form-row">
                  <div className="form-group col-md-12"><label>Symptom</label><input className="form-control form-control-sm" value={formData.symptom} onChange={e => this.handleChange('symptom', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-6"><label>Problem in Method</label><textarea className="form-control form-control-sm" rows={3} value={formData.problem_method} onChange={e => this.handleChange('problem_method', e.target.value)} /></div>
                  <div className="form-group col-md-6"><label>Problem in Material</label><textarea className="form-control form-control-sm" rows={3} value={formData.problem_material} onChange={e => this.handleChange('problem_material', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-6"><label>Problem in Environment</label><textarea className="form-control form-control-sm" rows={3} value={formData.problem_environment} onChange={e => this.handleChange('problem_environment', e.target.value)} /></div>
                  <div className="form-group col-md-6"><label>Problem in Man</label><textarea className="form-control form-control-sm" rows={3} value={formData.problem_man} onChange={e => this.handleChange('problem_man', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-12"><label>Problem in Machine</label><textarea className="form-control form-control-sm" rows={3} value={formData.problem_machine} onChange={e => this.handleChange('problem_machine', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-12"><label>Actual Cause of Problem</label><textarea className="form-control form-control-sm" rows={4} value={formData.actualCause} onChange={e => this.handleChange('actualCause', e.target.value)} /></div>
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
          {['showAll', 'psc', 'corrective', 'root'].map(key => (
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
                <th>Actions</th>
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
                  <td>
                    <button className="btn btn-sm btn-outline-primary mr-2" onClick={() => this.toggleForm(c)}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => this.handleDelete(c.id)}>Delete</button>
                  </td>
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