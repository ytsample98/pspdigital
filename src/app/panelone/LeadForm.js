import React, { Component } from 'react';
import { Dropdown } from 'react-bootstrap';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import '../../assets/styles/components/_overlay.scss';

const STAGE_OPTIONS = ['Qualification', 'Proposal', 'Negotiation', 'Closed'];
const STATUS_OPTIONS = ['Hot', 'Warm', 'Cold', 'Dormant'];
const PRIORITY_OPTIONS = ['1', '2', '3', '4', '5'];
const SOURCE_OPTIONS = ['Call', 'Direct Meeting', 'Email', 'Web', 'Others'];

class LeadForm extends Component {
  state = {
    leads: [],
    customers: [],
    showForm: false,
    overlayType: '',
    overlaySearch: '',
    formData: {
      leadNo: '',
      leadName: '',
      accountName: '',
      stage: STAGE_OPTIONS[0],
      status: STATUS_OPTIONS[0],
      priority: PRIORITY_OPTIONS[0],
      source: SOURCE_OPTIONS[0],
    }
  };

  componentDidMount() {
    this.fetchLeads();
    this.fetchCustomers();
  }

  fetchLeads = async () => {
    const snap = await getDocs(collection(db, 'leads'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ leads: data });
  };

  fetchCustomers = async () => {
    const snap = await getDocs(collection(db, 'customers'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ customers: data });
  };

  
  handleChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { leads, formData } = this.state;
    // Auto-generate leadNo if not present
    let leadNo = formData.leadNo;
    if (!leadNo) {
      leadNo = `LD${101 + leads.length}`;
    }
    const newLead = { ...formData, leadNo };
    await addDoc(collection(db, 'leads'), newLead);
    this.setState({
      formData: {
        leadNo: '',
        leadName: '',
        accountName: '',
        stage: STAGE_OPTIONS[0],
        status: STATUS_OPTIONS[0],
        priority: PRIORITY_OPTIONS[0],
        source: SOURCE_OPTIONS[0],
      },
      showForm: false
    });
    this.fetchLeads();
  };

  deleteLead = async (id) => {
    await deleteDoc(doc(db, 'leads', id));
    this.fetchLeads();
  };
convertToProspect = (lead) => {
    const params = new URLSearchParams();
    params.set('org', lead.accountName);
    params.set('client', lead.leadName);
    window.location.href = `/panelone/Prospect?${params.toString()}`;

  };


  showOverlay = (type) => this.setState({ overlayType: type, overlaySearch: '' });
  hideOverlay = () => this.setState({ overlayType: '', overlaySearch: '' });

  selectOverlayValue = (value) => {
    if (this.state.overlayType === 'accountName') {
      this.setState(prev => ({
        formData: {
          ...prev.formData,
          accountName: value.name,
        },
        overlayType: '',
        overlaySearch: ''
      }));
    }
  };

  renderOverlay = () => {
    const { overlayType, overlaySearch, customers } = this.state;
    let data = [];
    let label = '';
    let columns = [];
    if (overlayType === 'accountName') {
      data = customers;
      label = 'Account Name';
      columns = ['code', 'name', 'shortName'];
    }
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <div className="custom-overlay-title">Select {label}</div>
          <div className="custom-search-bar">
            <input
              type="text"
              className="form-control"
              placeholder={`Search ${label.toLowerCase()}...`}
              value={overlaySearch}
              onChange={e => this.setState({ overlaySearch: e.target.value })}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="table table-bordered table-sm" style={{ cursor: 'pointer' }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col}>{col.charAt(0).toUpperCase() + col.slice(1)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data
                  .filter(d =>
                    columns.some(col =>
                      (d[col] || '').toLowerCase().includes((overlaySearch || '').toLowerCase())
                    )
                  )
                  .map((d, i) => (
                    <tr
                      key={d.id || i}
                      onClick={() => this.selectOverlayValue(d)}
                    >
                      {columns.map(col => (
                        <td key={col}>{d[col]}</td>
                      ))}
                    </tr>
                  ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="text-center">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary mt-3 align-self-end" onClick={this.hideOverlay}>
            Cancel
          </button>
        </div>
      </div>
    );
  };

  renderForm = () => {
    const { formData, overlayType } = this.state;
    return (
      <div className="card mt-4 full-height">
        <div className="card-body">
          <h4 className="card-title">Lead Form</h4>
          <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
            <div className="form-row">
              <div className="form-group col-md-2">
                <label>Lead No</label>
                <input
                  className="form-control form-control-sm"
                  value={formData.leadNo || `LD${101 + this.state.leads.length}`}
                  readOnly
                  style={{ background: '#f8f9fa', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group col-md-3">
                <label>Lead Name <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="form-control form-control-sm"
                  value={formData.leadName}
                  onChange={e => this.handleChange('leadName', e.target.value)}
                  required
                />
              </div>
              <div className="form-group col-md-3">
                <label>Account Name <span style={{ color: 'red' }}>*</span></label>
                <div className="input-group input-group-sm">
                  <input
                    className="form-control"
                    value={formData.accountName}
                    readOnly
                    style={{ background: '#fff', cursor: 'pointer' }}
                    onClick={() => this.showOverlay('accountName')}
                    required
                  />
                  <div className="input-group-append">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      tabIndex={-1}
                      style={{ borderColor: '#ced4da', background: '#f8f9fa' }}
                      onClick={() => this.showOverlay('accountName')}
                    >
                      <i className="mdi mdi-magnify"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group col-md-2">
                <label>Stage</label>
                <select
                  className="form-control form-control-sm"
                  value={formData.stage}
                  onChange={e => this.handleInputChange('stage', e.target.value)}
                >
                  {STAGE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="form-group col-md-2">
                <label>Status</label>
                <select
                  className="form-control form-control-sm"
                  value={formData.status}
                  onChange={e => this.handleInputChange('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-2">
                <label>Priority</label>
                <select
                  className="form-control form-control-sm"
                  value={formData.priority}
                  onChange={e => this.handleInputChange('priority', e.target.value)}
                >
                  {PRIORITY_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="form-group col-md-3">
                <label>Source</label>
                <select
                  className="form-control form-control-sm"
                  value={formData.source}
                  onChange={e => this.handleInputChange('source', e.target.value)}
                >
                  {SOURCE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
            <div className="d-flex justify-content-between mt-3">
              <button type="submit" className="btn btn-success btn-sm">Save</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ showForm: false })}>Cancel</button>
            </div>
            {overlayType && this.renderOverlay()}
          </form>
        </div>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Leads</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.setState({ showForm: true })}>+ Add Lead</button>
        </div>
        <table className="table table-bordered table-sm">
          <thead className="thead-light">
            <tr>
              <th>Lead No</th>
              <th>Lead Name</th>
              <th>Account Name</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {this.state.leads.map((lead, i) => (
              <tr key={i}>
                <td>{lead.leadNo}</td>
                <td>{lead.leadName}</td>
                <td>{lead.accountName}</td>
                <td>{lead.stage}</td>
                <td>{lead.status}</td>
                <td>{lead.priority}</td>
                <td>{lead.source}</td>
                <td>
                  <Dropdown>
                    <Dropdown.Toggle variant="outline-primary" size="sm">
                      Action
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => this.deleteLead(lead.id)}>Delete</Dropdown.Item>
                      <Dropdown.Item onClick={() => this.convertToProspect(lead)}  disabled={!lead.accountName || !lead.leadName}>Convert to Prospect</Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </td>
              </tr>
            ))}
            {this.state.leads.length === 0 && (
              <tr><td colSpan="8" className="text-center">No leads found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  render() {
    return (
      <div className="container-fluid">
        {this.state.showForm ? this.renderForm() : this.renderTable()}
      </div>
    );
  }
}

export default LeadForm;