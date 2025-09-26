import React, { Component } from 'react';
import { db } from '../../../firebase';import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import '../../../assets/styles/components/_custom-table.scss';

const CLASSIFICATION_OPTIONS = ['Purchase', 'Sales', 'Finance'];
const TYPE_OPTIONS = ['Percentage', 'Flat Amount'];

class Taxgroup extends Component {
  state = {
    taxGroups: [],
    taxComponents: [],
    showForm: false,
    showComponentOverlay: false,
    editingId: null,
    componentSearch: '',
    activeTab: 'tax',
    hsnData: [], 
    hsnAdding: false,
    hsnEditing: false,
    hsnEditIndex: null,
    newHsnValue: '',
    formData: {
      groupName: '',
      classification: 'Finance',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      seqNo: '',
      component: '',
      type: 'Percentage',
      appliedOn: '',
      percentOrAmt: '',
      lineItems: [],
      editIndex: null // for editing line item
    }
  };

  componentDidMount() {
    this.fetchTaxGroups();
    this.fetchTaxComponents();
  }

  fetchTaxGroups = async () => {
    const snap = await getDocs(collection(db, 'taxGroups'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ taxGroups: data });
  };

  fetchTaxComponents = async () => {
    // Fetch from Firestore or use static for demo
    const snap = await getDocs(collection(db, 'taxcomp'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ taxComponents: data });
  };

  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({ showForm: true, editingId: edit.id, activeTab: 'tax', formData: { ...edit, editIndex: null } });
    } else {
      this.setState({
        showForm: true,
        editingId: null,
        activeTab: 'tax',
        hsnData: [], 
        hsnAdding: false,
        hsnEditing: false,
        hsnEditIndex: null,
        newHsnValue: '',
        formData: {
          groupName: '',
          classification: 'Finance',
          effectiveFrom: new Date().toISOString().split('T')[0],
          effectiveTo: '',
          seqNo: '',
          component: '',
          type: 'Percentage',
          appliedOn: '',
          percentOrAmt: '',
          lineItems: [],
          editIndex: null
        }
      });
    }
  };

  handleChange = (field, value) => {
    if (field === 'percentOrAmt' && this.state.formData.type === 'Percentage' && value > 100) {
      value = 100;
    }
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleTypeChange = (value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, type: value, percentOrAmt: '' }
    }));
  };

  handleLineItemEdit = (idx) => {
    const item = this.state.formData.lineItems[idx];
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        seqNo: item.seqNo,
        component: item.component,
        type: item.type,
        appliedOn: item.appliedOn,
        percentOrAmt: item.percentOrAmt,
        editIndex: idx
      }
    }));
  };

  handleLineItemAddOrUpdate = () => {
    const { seqNo, component, type, appliedOn, percentOrAmt, lineItems, editIndex } = this.state.formData;
    if (!seqNo || !component) return alert('Seq No and Component are required');
    let newLine = { seqNo, component, type, appliedOn, percentOrAmt };
    let newLines = [...lineItems];
    if (editIndex !== null) {
      newLines[editIndex] = newLine;
    } else {
      newLines.push(newLine);
    }
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        lineItems: newLines,
        seqNo: '',
        component: '',
        type: 'Percentage',
        appliedOn: '',
        percentOrAmt: '',
        editIndex: null
      }
    }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData } = this.state;
    if (!formData.groupName) return alert('Enter group name');
    if (editingId) {
      await setDoc(doc(db, 'taxGroups', editingId), formData);
    } else {
      await addDoc(collection(db, 'taxGroups'), formData);
    }
    this.setState({ showForm: false, editingId: null });
    this.fetchTaxGroups();
  };

  handleDelete = async (id) => {
    await deleteDoc(doc(db, 'taxGroups', id));
    this.fetchTaxGroups();
  };

  showComponentOverlay = () => this.setState({ showComponentOverlay: true, componentSearch: '' });
  hideComponentOverlay = () => this.setState({ showComponentOverlay: false });

  selectComponent = (name) => {
    this.setState(prev => ({
      formData: { ...prev.formData, component: name },
      showComponentOverlay: false
    }));
  };

  renderComponentOverlay = () => {
    const { taxComponents, componentSearch } = this.state;
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <div className="custom-overlay-title">Select Tax Component</div>
          <div className="custom-search-bar">
            <input
              type="text"
              className="form-control"
              placeholder="Search component..."
              value={componentSearch}
              onChange={e => this.setState({ componentSearch: e.target.value })}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="table table-bordered table-sm" style={{ cursor: 'pointer' }}>
              <thead>
                <tr>
                  <th>Component Code</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
              {taxComponents
                .filter(c => c.name && c.name.toLowerCase().includes((componentSearch || '').toLowerCase()))
                .map((c, i) => (
                  <tr key={c.id} onClick={() => this.selectComponent(c.name)} style={{ cursor: 'pointer' }}>
                    <td>{c.code}</td>
                    <td>{c.name || ''}</td>
                  </tr>
                ))}
              {taxComponents.length === 0 && (
                <tr>
                  <td colSpan="2" className="text-center">No records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button className="btn btn-secondary mt-3 align-self-end" onClick={this.hideComponentOverlay}>Cancel</button>
      </div>
    </div>
  );
};

  renderForm = () => {
    const { formData, showComponentOverlay, activeTab } = this.state;
    return (
      <div className="card full-height" onSubmit={this.handleSubmit}>
         <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">Tax Group Creation/Update</h4>
        <ul className="nav nav-tabs" role="tablist">
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === 'tax' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'tax' })}>Tax Details</button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === 'hsn' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'hsn' })}>HSN/SAC Mapping</button>
          </li>
        </ul>
        {activeTab === 'tax' && (
          <form className="form-sample mt-3" onSubmit={this.handleSubmit} autoComplete="off">
            <div className="form-row">
              <div className="form-group col-md-3">
                <label>Group Name</label>
                <input className="form-control form-control-sm" value={formData.groupName} type="name" onChange={e => this.handleChange('groupName', e.target.value)} required />
              </div>
              <div className="form-group col-md-2">
                <label>Classification</label>
                <select className="form-control form-control-sm" value={formData.classification} onChange={e => this.handleChange('classification', e.target.value)}>
                  {CLASSIFICATION_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="form-group col-md-2">
                <label>Effective From</label>
                <input className="form-control form-control-sm" type="date" value={formData.effectiveFrom} onChange={e => this.handleChange('effectiveFrom', e.target.value)} />
              </div>
              <div className="form-group col-md-2">
                <label>Effective To</label>
                <input className="form-control form-control-sm" type="date" value={formData.effectiveTo} onChange={e => this.handleChange('effectiveTo', e.target.value)} />
              </div>
            </div>
            {/* Line Item Entry */}
            <div className="form-row">
              <div className="form-group col-md-1">
                <label>Seq No</label>
                <input className="form-control form-control-sm" type="number" value={formData.seqNo} onChange={e => this.handleChange('seqNo', e.target.value)} />
              </div>
              <div className="form-group col-md-3">
                <label>Component</label>
                <div className="input-group input-group-sm">
                  <input className="form-control" value={formData.component} readOnly onClick={this.showComponentOverlay} style={{ background: '#f8f9fa', cursor: 'pointer' }} />
                  <div className="input-group-append">
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={this.showComponentOverlay}>Select</button>
                  </div>
                </div>
              </div>
              <div className="form-group col-md-2">
                <label>Type</label>
                <select className="form-control form-control-sm" value={formData.type} onChange={e => this.handleTypeChange(e.target.value)}>
                  {TYPE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="form-group col-md-2">
                <label>Applied On</label>
                <input className="form-control form-control-sm" value={formData.appliedOn} onChange={e => this.handleChange('appliedOn', e.target.value)} />
              </div>
              <div className="form-group col-md-2">
                <label>Percentage/Amount</label>
                <input
                  className="form-control form-control-sm"
                  type="number"
                  value={formData.percentOrAmt}
                  max={formData.type === 'Percentage' ? 100 : undefined}
                  onChange={e => this.handleChange('percentOrAmt', e.target.value)}
                />
              </div>
              <div className="form-group col-md-2 d-flex align-items-end">
                <button type="button" className="btn btn-primary btn-sm" style={{ minWidth: 100 }} onClick={this.handleLineItemAddOrUpdate}>
                  {formData.editIndex !== null ? 'Update' : 'Add/Update'}
                </button>
              </div>
            </div>
            {/* Line Item Table */}
            <div className="custom-table-responsive">
              <table className="table table-bordered table-sm mt-2">
                <thead>
                  <tr>
                    <th>Edit</th>
                    <th>Seq.No</th>
                    <th>Component Name</th>
                    <th>Type</th>
                    <th>Applied On</th>
                    <th>Per/Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Fixed first row for Material Cost */}
                  <tr className="bg-light font-weight-bold">
                    <td ><input type="radio" disabled /></td>
                    <td>1</td>
                    <td>Material Cost</td>
                    <td>-</td>
                    <td>0</td>
                    <td>-</td>
                  </tr>

                  {/* Dynamic line items from formData */}
                  {formData.lineItems.length > 0 ? formData.lineItems.map((item, idx) => (
                    <tr key={idx + 1}>
                      <td>
                        <input
                          type="radio"
                          name="editLine"
                          checked={formData.editIndex === idx}
                          onChange={() => this.handleLineItemEdit(idx)}
                        />
                      </td>
                      <td>{item.seqNo}</td>
                      <td>{item.component}</td>
                      <td>{item.type}</td>
                      <td>{item.appliedOn}</td>
                      <td>{item.percentOrAmt}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" className="text-center text-muted">No additional line items</td></tr>
                  )}
                </tbody>

              </table>
            </div>
            <div className="fixed-card-footer ">
              <div>
                <button type="submit" className="btn btn-primary btn-sm mr-2">Create</button>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ showForm: false })}>Cancel</button>
              
            </div>
          </form>
        )}
  {activeTab === 'hsn' && (
  <div className="mt-3 border rounded p-3">
    {/* Header */}
    <div className="d-flex justify-content-between align-items-center mb-2">
      <div>
        <button
          className="btn btn-outline-primary btn-sm mr-2"
          onClick={() => this.setState({ hsnEditing: true })}
        >
          Edit
        </button>
        <button
          className="btn btn-outline-success btn-sm"
          onClick={() => this.setState({ hsnAdding: true, newHsnValue: '', hsnEditIndex: null })}
        >
          Add Row
        </button>
      </div>
    </div>

    {/* Table */}
    <table className="table table-bordered table-sm text-center">
      <thead className="thead-light">
        <tr>
          <th>Edit</th>
          <th>HSN/SAC No</th>
          <th>Created Date</th>
          <th>Updated Date</th>
        </tr>
      </thead>
      <tbody>
        {/* Add Row Inline Input */}
        {this.state.hsnAdding && (
          <tr>
            <td colSpan={4}>
              <div className="d-flex align-items-center justify-content-center">
                <input
                  className="form-control form-control-sm mr-2 w-25"
                  placeholder="Enter HSN/SAC"
                  value={this.state.newHsnValue}
                  onChange={(e) => this.setState({ newHsnValue: e.target.value })}
                />
                <button
                  className="btn btn-sm btn-success mr-2"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    const newEntry = {
                      hsn: this.state.newHsnValue,
                      created: today,
                      updated: ''
                    };
                    this.setState((prev) => ({
                      hsnData: [...prev.hsnData, newEntry],
                      newHsnValue: '',
                      hsnAdding: false
                    }));
                  }}
                >
                  Save
                </button>
                <button
                  className="btn btn-sm btn-link text-danger"
                  onClick={() => this.setState({ hsnAdding: false })}
                >
                  Cancel
                </button>
              </div>
            </td>
          </tr>
        )}

        {/* Data Rows */}
        {this.state.hsnData.length > 0 ? (
          this.state.hsnData.map((row, i) => (
            <tr key={i}>
              <td>
                {this.state.hsnEditing && (
                  <input
                    type="radio"
                    name="editRow"
                    checked={this.state.hsnEditIndex === i}
                    onChange={() => this.setState({ hsnEditIndex: i })}
                  />
                )}
              </td>
              <td>
                {this.state.hsnEditing && this.state.hsnEditIndex === i ? (
                  <input
                    className="form-control form-control-sm"
                    value={row.hsn}
                    onChange={(e) => {
                      const hsnData = [...this.state.hsnData];
                      hsnData[i].hsn = e.target.value;
                      hsnData[i].updated = new Date().toISOString().split('T')[0];
                      this.setState({ hsnData });
                    }}
                  />
                ) : (
                  row.hsn
                )}
              </td>
              <td>{row.created}</td>
              <td>{row.updated}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4}>
              <div className="d-flex justify-content-center align-items-center" style={{ height: 120, color: '#999' }}>
                <i className="mdi mdi-magnify" style={{ fontSize: 24, marginRight: 8 }} />
                No data found
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
)}



        {showComponentOverlay && this.renderComponentOverlay()}
      </div>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Tax Groups</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>+ Add Tax Group</button>
        </div>
        <div className="custom-table-responsive">
          <table className="table table-bordered table-sm">
            <thead className='thead-light'>
              <tr>
                <th>Group Name</th>
                <th>Classification</th>
                <th>Effective From</th>
                <th>Effective To</th>
              </tr>
            </thead>
            <tbody>
              {this.state.taxGroups.map((g, i) => (
                <tr key={g.id}>
                  <td><button className='btn btn-link p-0' onClick={() => this.toggleForm(g)}>{g.groupName}</button></td>
                  <td>{g.classification}</td>
                  <td>{g.effectiveFrom}</td>
                  <td>{g.effectiveTo}</td>
                </tr>
              ))}
              {this.state.taxGroups.length === 0 && <tr><td colSpan="5" className="text-center">No records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  render() {
    return <div className="container-fluid">{this.state.showForm ? this.renderForm() : this.renderTable()}</div>;
  }
}

export default Taxgroup;