// ✅ Fixed ProspectForm.js (preserving all fields)
// - Keeps original fields like amount, representative, etc.
// - Supports conversion from Lead → Prospect with prefill
// - Converts Prospect → Quote correctly using customer.name

import React, { Component } from 'react';
import { Dropdown } from 'react-bootstrap';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';

class ProspectForm extends Component {
  state = {
    prospects: [],
    customers: [],
    showForm: false,
    overlayType: '',
    overlaySearch: '',
    formData: {
      prospectNo: '',
      customerName: '',
      amount: '',
      representative: '',
      stage: 'New',
      status: 'Open'
    }
  };

  componentDidMount() {
    this.fetchProspects();
    this.fetchCustomers();

    // ✅ Prefill from Lead
    const params = new URLSearchParams(window.location.search);
    const org = params.get('org');
    const client = params.get('client');
    if (org || client) {
      this.setState(prev => ({
        showForm: true,
        formData: {
          ...prev.formData,
          customerName: org || '',
          representative: client || ''
        }
      }));
    }
  }

  fetchProspects = async () => {
    const snap = await getDocs(collection(db, 'prospects'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ prospects: data });
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
    const { formData, prospects } = this.state;
    if (!formData.prospectNo) {
      formData.prospectNo = `PR${1000 + prospects.length}`;
    }
    await addDoc(collection(db, 'prospects'), formData);
    this.setState({ showForm: false, formData: { prospectNo: '', customerName: '', amount: '', representative: '', stage: 'New', status: 'Open' } });
    this.fetchProspects();
  };

  convertToQuote = (prospect) => {
    const params = new URLSearchParams();
    params.set('org', prospect.customerName); // ✅ matches with Quote.js expectation
    params.set('prospect', prospect.prospectNo);
    window.location.href = `/panelone/Quote?${params.toString()}`;
  };

  showOverlay = () => this.setState({ overlayType: 'customer', overlaySearch: '' });
  hideOverlay = () => this.setState({ overlayType: '', overlaySearch: '' });

  selectOverlayValue = (value) => {
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        customerName: value.name
      },
      overlayType: '',
      overlaySearch: ''
    }));
  };

  renderOverlay = () => {
    const { overlaySearch, customers } = this.state;
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <div className="custom-overlay-title">Select Customer</div>
          <input
            type="text"
            className="form-control"
            placeholder="Search customer"
            value={overlaySearch}
            onChange={e => this.setState({ overlaySearch: e.target.value })}
          />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="table table-bordered table-sm">
              <thead>
                <tr><th>Name</th><th>Code</th><th>Short Name</th></tr>
              </thead>
              <tbody>
                {customers.filter(c =>
                  (c.name || '').toLowerCase().includes(overlaySearch.toLowerCase())
                ).map((c, i) => (
                  <tr key={i} onClick={() => this.selectOverlayValue(c)}>
                    <td>{c.name}</td><td>{c.code}</td><td>{c.shortName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary btn-sm mt-2" onClick={this.hideOverlay}>Cancel</button>
        </div>
      </div>
    );
  };

  render() {
    const { formData, showForm, overlayType, prospects } = this.state;
    return (
      <div className="container-fluid">
        {showForm ? (
          <div className="card mt-4">
            <div className="card-body">
              <h4 className="card-title">Prospect Form</h4>
              <form onSubmit={this.handleSubmit}>
                <div className="form-row">
                  <div className="form-group col-md-3">
                    <label>Prospect No</label>
                    <input className="form-control" value={formData.prospectNo || ''} readOnly />
                  </div>
                  <div className="form-group col-md-6">
                    <label>Customer</label>
                    <div className="input-group">
                      <input
                        className="form-control"
                        value={formData.customerName || ''}
                        readOnly
                        onClick={this.showOverlay}
                      />
                      <div className="input-group-append">
                        <button type="button" className="btn btn-outline-secondary" onClick={this.showOverlay}>
                          <i className="mdi mdi-magnify"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-4">
                    <label>Amount</label>
                    <input className="form-control" value={formData.amount || ''} onChange={e => this.handleChange('amount', e.target.value)} />
                  </div>
                  <div className="form-group col-md-4">
                    <label>Representative</label>
                    <input className="form-control" value={formData.representative || ''} onChange={e => this.handleChange('representative', e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-success btn-sm">Save</button>
              </form>
              {overlayType && this.renderOverlay()}
            </div>
          </div>
        ) : (
          <div className="card mt-4">
            <div className="card-body">
              <div className="d-flex justify-content-between mb-3">
                <h4 className="card-title">Prospects</h4>
                <button className="btn btn-primary btn-sm" onClick={() => this.setState({ showForm: true })}>+ Add Prospect</button>
              </div>
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Prospect No</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Representative</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p, i) => (
                    <tr key={i}>
                      <td>{p.prospectNo}</td>
                      <td>{p.customerName}</td>
                      <td>{p.amount}</td>
                      <td>{p.representative}</td>
                      <td>{p.status}</td>
                      <td>
                        <Dropdown>
                          <Dropdown.Toggle variant="outline-primary" size="sm">Action</Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => this.convertToQuote(p)} disabled={!p.customerName}>Convert to Quote</Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                  {prospects.length === 0 && (
                    <tr><td colSpan="6" className="text-center">No records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default ProspectForm;
