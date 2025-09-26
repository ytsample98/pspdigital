import React, { Component } from 'react';
import { db } from '../../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import '../../../assets/styles/components/_custom-table.scss';

const TYPE_OPTIONS = [
  'Dock Door', 'Customer Rejection', 'Line Rejection', 'Inspection Station',
  'Packing Station', 'Plan Locator', 'Receiving', 'Scrap Locator',
  'Staging Lane', 'Store Locator', 'Supplier Rejection'
];

class Locator extends Component {
  state = {
    locators: [],
    warehouses: [],
    showForm: false,
    showWarehouseOverlay: false,
    editingId: null,
    warehouseSearch: '',
    formData: {
      locatorName: '',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      warehouse: '',
      type: TYPE_OPTIONS[0],
      maxQty: '',
      currentQty: '',
      suggestedQty: '',
      description: ''
    }
  };

  componentDidMount() {
    this.fetchLocators();
    this.fetchWarehouses();
  }

  fetchLocators = async () => {
    const snap = await getDocs(collection(db, 'locators'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ locators: data });
  };

  fetchWarehouses = async () => {
    const snap = await getDocs(collection(db, 'warehouses'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ warehouses: data });
  };

  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({ showForm: true, editingId: edit.id, formData: { ...edit } });
    } else {
      this.setState({
        showForm: true,
        editingId: null,
        formData: {
          locatorName: '',
          effectiveFrom: new Date().toISOString().split('T')[0],
          effectiveTo: '',
          warehouse: '',
          type: TYPE_OPTIONS[0],
          maxQty: '',
          currentQty: '',
          suggestedQty: '',
          description: ''
        }
      });
    }
  };

  handleChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData } = this.state;
    if (!formData.locatorName) return alert('Enter locator name');
    if (editingId) {
      await setDoc(doc(db, 'locators', editingId), formData);
    } else {
      await addDoc(collection(db, 'locators'), formData);
    }
    this.setState({ showForm: false, editingId: null });
    this.fetchLocators();
  };

  handleDelete = async (id) => {
    await deleteDoc(doc(db, 'locators', id));
    this.fetchLocators();
  };

  showWarehouseOverlay = () => this.setState({ showWarehouseOverlay: true, warehouseSearch: '' });
  hideWarehouseOverlay = () => this.setState({ showWarehouseOverlay: false });

  selectWarehouse = (w) => {
    this.setState(prev => ({
      formData: { ...prev.formData, 
        warehouseId:w.code,
        warehouse: w.name },
      showWarehouseOverlay: false
    }));
  };

  renderWarehouseOverlay = () => {
    const { warehouses, warehouseSearch } = this.state;
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <div className="custom-overlay-title">Select Warehouse</div>
          <div className="custom-search-bar">
            <input
              type="text"
              className="form-control"
              placeholder="Search warehouse..."
              value={warehouseSearch}
              onChange={e => this.setState({ warehouseSearch: e.target.value })}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Effective From</th>
                  <th>Effective To</th>
                </tr>
              </thead>
              <tbody>
                {warehouses
                  .filter(w => w.name && w.name.toLowerCase().includes((warehouseSearch || '').toLowerCase()))
                  .map((w, i) => (
                    <tr
                    key={w.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => this.selectWarehouse(w.name)}
                  >
                    <td>{w.name}</td>
                    <td>{w.location}</td>
                    <td>{w.type}</td>
                    <td>{w.effectiveFrom}</td>
                    <td>{w.effectiveTo}</td>
                    <td className="text-muted"><small>(click row)</small></td>
                  </tr>

                  ))}
                {warehouses.length === 0 && <tr><td colSpan="6" className="text-center">No records found</td></tr>}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary mt-3 align-self-end" onClick={this.hideWarehouseOverlay}>Cancel</button>
        </div>
      </div>
    );
  };

  renderForm = () => {
    const { formData, showWarehouseOverlay } = this.state;
    return (
      <div className="card full-height" onSubmit={this.handleSubmit}>
         <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">Locator</h4>
        <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
          <div className="form-row">
            <div className="form-group col-md-3">
              <label>Locator Name</label>
              <input className="form-control form-control-sm" value={formData.locatorName} onChange={e => this.handleChange('locatorName', e.target.value)} required />
            </div>
            <div className="form-group col-md-2">
              <label>Effective From</label>
              <input className="form-control form-control-sm" type="date" value={formData.effectiveFrom} onChange={e => this.handleChange('effectiveFrom', e.target.value)} />
            </div>
            <div className="form-group col-md-2">
              <label>Effective To</label>
              <input className="form-control form-control-sm" type="date" value={formData.effectiveTo} onChange={e => this.handleChange('effectiveTo', e.target.value)} />
            </div>
            <div className="form-group col-md-3">
              <label>Warehouse</label>
              <div className="input-group input-group-sm">
                <input className="form-control" value={formData.warehouse} readOnly onClick={this.showWarehouseOverlay} style={{ background: '#f8f9fa', cursor: 'pointer' }} />
                <div className="input-group-append">
                  <button className="btn btn-outline-secondary btn-sm" type="button" onClick={this.showWarehouseOverlay}>Select</button>
                </div>
              </div>
            </div>
            <div className="form-group col-md-2">
              <label>Type</label>
              <select className="form-control form-control-sm" value={formData.type} onChange={e => this.handleChange('type', e.target.value)}>
                {TYPE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group col-md-2">
              <label>Max Qty</label>
              <input className="form-control form-control-sm" type="number" value={formData.maxQty} onChange={e => this.handleChange('maxQty', e.target.value)} />
            </div>
            <div className="form-group col-md-2">
              <label>Current Qty</label>
              <input className="form-control form-control-sm" type="number" value={formData.currentQty} onChange={e => this.handleChange('currentQty', e.target.value)} />
            </div>
            <div className="form-group col-md-2">
              <label>Suggested Qty</label>
              <input className="form-control form-control-sm" type="number" value={formData.suggestedQty} onChange={e => this.handleChange('suggestedQty', e.target.value)} />
            </div>
            
          </div>
          <div className="form-row">
            <div className="form-group col-md-6">
              <label>Description</label>
              <textarea className="form-control form-control-sm" rows={2} value={formData.description} onChange={e => this.handleChange('description', e.target.value)} />
            </div>
            </div>          
            <div className="fixed-card-footer">
            <button type="submit" className="btn btn-success btn-sm">Save</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ showForm: false })}>Cancel</button>
          </div>
        </form>
        {showWarehouseOverlay && this.renderWarehouseOverlay()}
      </div>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Locators</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>+ Add Locator</button>
        </div>
        <div className="custom-table-responsive">
          <table className="table table-bordered table-sm">
            <thead className='thead-light'>
              <tr>
                <th>Locator</th>
                <th>Type</th>
                <th>Max Qty</th>
                <th>Current Qty</th>
                <th>Suggested Qty</th>
                <th>Effective From</th>
                <th>Effective To</th>
              </tr>
            </thead>
            <tbody>
              {this.state.locators.map((l, i) => (
                <tr key={l.id}>
                  <td><button className='btn btn-link p-0' onClick={() => this.toggleForm(l)}>{l.locatorName}</button></td>
                  <td>{l.type}</td>
                  <td>{l.maxQty}</td>
                  <td>{l.currentQty}</td>
                  <td>{l.suggestedQty}</td>
                  <td>{l.effectiveFrom}</td>
                  <td>{l.effectiveTo}</td>
                </tr>
              ))}
              {this.state.locators.length === 0 && <tr><td colSpan="7" className="text-center">No records found</td></tr>}
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

export default Locator;