import React, { Component } from 'react';
import { db } from '../../../firebase';import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

class OpenStockUpdate extends Component {
  state = {
    openStocks: [],
    products: [],
    warehouses: [],
    locators: [],
    showForm: false,
    showOverlay: false,
    overlayType: '',
    overlaySearch: '',
    editingId: null,
    activeTab: 'main',
    formData: {
      opsid: '',
      opstype: 'Opening Stock',
      date: new Date().toISOString().split('T')[0],
      status: 'Entered',
      item: '',
      warehouse: '',
      locator: '',
      qty: '',
      lineItems: [],
      editIndex: null
    }
  };

  componentDidMount() {
    this.fetchOpenStocks();
    this.fetchProducts();
    this.fetchWarehouses();
    this.fetchLocators();
  }

  fetchOpenStocks = async () => {
    const snap = await getDocs(collection(db, 'openStocks'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ openStocks: data });
  };

  fetchProducts = async () => {
    const snap = await getDocs(collection(db, 'products'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ products: data });
  };

  fetchWarehouses = async () => {
    const snap = await getDocs(collection(db, 'warehouses'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ warehouses: data });
  };

  fetchLocators = async () => {
    const snap = await getDocs(collection(db, 'locators'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ locators: data });
  };

  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({
        showForm: true,
        editingId: edit.id,
        activeTab: 'main',
        formData: { ...edit, editIndex: null }
      });
    } else {
      this.setState({
        showForm: true,
        editingId: null,
        activeTab: 'main',
        formData: {
          opsid: '',
          opstype: 'Opening Stock',
          date: new Date().toISOString().split('T')[0],
          status: 'Entered',
          item: '',
          warehouse: '',
          locator: '',
          qty: '',
          lineItems: [],
          editIndex: null
        }
      });
    }
  };

  handleChange = (field, value) => {
    if (field === 'qty' && value && !/^\d*$/.test(value)) return; // Only numbers
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleLineItemEdit = (idx) => {
    const item = this.state.formData.lineItems[idx];
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        item: item.item,
        warehouse: item.warehouse,
        locator: item.locator,
        qty: item.qty,
        editIndex: idx
      }
    }));
  };

  handleLineItemAddOrUpdate = () => {
    const { item, warehouse, locator, qty, lineItems, editIndex } = this.state.formData;
    if (!item || !warehouse || !locator || !qty) return alert('All fields required');
    let newLine = { item, warehouse, locator, qty };
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
        item: '',
        warehouse: '',
        locator: '',
        qty: '',
        editIndex: null
      }
    }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData, openStocks } = this.state;
    if (formData.lineItems.length === 0) return alert('Add at least one line item');
    let opsid = formData.opsid;
    if (!opsid) opsid = `OPS${1000 + openStocks.length}`;
    const submitData = { ...formData, opsid };
    delete submitData.editIndex;
    if (editingId) {
      await setDoc(doc(db, 'openStocks', editingId), submitData);
    } else {
      await addDoc(collection(db, 'openStocks'), submitData);
    }
    this.setState({ showForm: false, editingId: null });
    this.fetchOpenStocks();
  };

  handleDelete = async (id) => {
    await deleteDoc(doc(db, 'openStocks', id));
    this.fetchOpenStocks();
  };

  showOverlay = (type) => this.setState({ showOverlay: true, overlayType: type, overlaySearch: '' });
  hideOverlay = () => this.setState({ showOverlay: false, overlayType: '', overlaySearch: '' });

  selectOverlayValue = (value) => {
    const { overlayType } = this.state;
    if (overlayType === 'item') {
      this.setState(prev => ({
        formData: { ...prev.formData, item: value.name },
        showOverlay: false,
        overlayType: ''
      }));
    } else if (overlayType === 'warehouse') {
      this.setState(prev => ({
        formData: { ...prev.formData, warehouse: value.name },
        showOverlay: false,
        overlayType: ''
      }));
    } else if (overlayType === 'locator') {
      this.setState(prev => ({
        formData: { ...prev.formData, locator: value.name },
        showOverlay: false,
        overlayType: ''
      }));
    }
  };


  renderForm = () => {
    const { formData } = this.state;
    return (
      <div className="card p-3 mt-3">
        <h4 className="mb-3">Opening Stock Update</h4>
        <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
          <div className="form-row">
            <div className="form-group col-md-2">
              <label>Doc No</label>
              <input className="form-control form-control-sm" value={formData.opsid || 'Auto'} readOnly />
            </div>
            <div className="form-group col-md-2">
              <label>Type</label>
              <input className="form-control form-control-sm" value={formData.opstype} readOnly />
            </div>
            <div className="form-group col-md-2">
              <label>Date</label>
              <input className="form-control form-control-sm" type="date" value={formData.date} onChange={e => this.handleChange('date', e.target.value)} />
            </div>
            <div className="form-group col-md-2">
              <label>Status</label>
              <input className="form-control form-control-sm" value={formData.status} readOnly />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group col-md-3">
              <label>Item</label>
              <div className="input-group">
                <input className="form-control form-control-sm" value={formData.item} readOnly />
                <div className="input-group-append">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => this.showOverlay('item')}>...</button>
                </div>
              </div>
            </div>
            <div className="form-group col-md-3">
              <label>Warehouse</label>
              <div className="input-group">
                <input className="form-control form-control-sm" value={formData.warehouse} readOnly />
                <div className="input-group-append">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => this.showOverlay('warehouse')}>...</button>
                </div>
              </div>
            </div>
            <div className="form-group col-md-3">
              <label>Store Locator</label>
              <div className="input-group">
                <input className="form-control form-control-sm" value={formData.locator} readOnly />
                <div className="input-group-append">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => this.showOverlay('locator')}>...</button>
                </div>
              </div>
            </div>
            <div className="form-group col-md-3">
              <label>Opening Qty</label>
              <input className="form-control form-control-sm" value={formData.qty} onChange={e => this.handleChange('qty', e.target.value)} />
            </div>
          </div>
          <div className="d-flex align-items-center mb-2">
            <button type="button" className="btn btn-primary btn-sm mr-2" style={{ minWidth: 120 }} onClick={this.handleLineItemAddOrUpdate}>
              {formData.editIndex !== null ? 'Update' : 'Add/Update'}
            </button>
          </div>
          {/* Line Item Table */}
          <div className="custom-table-responsive">
            <table className="table table-bordered table-sm mt-2">
              <thead>
                <tr>
                  <th>Edit</th>
                  <th>Item Name</th>
                  <th>Warehouse</th>
                  <th>Store Locator</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {formData.lineItems.length > 0 ? formData.lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="radio"
                        name="editLine"
                        checked={formData.editIndex === idx}
                        onChange={() => this.handleLineItemEdit(idx)}
                      />
                    </td>
                    <td>{item.item}</td>
                    <td>{item.warehouse}</td>
                    <td>{item.locator}</td>
                    <td>{item.qty}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">No Data Found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between mt-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ showForm: false })}>Cancel</button>
            <button type="submit" className="btn btn-success btn-sm">Create</button>
          </div>
        </form>
        {this.renderOverlay()}
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Opening Stock Update</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>+ Create</button>
        </div>
        <div className="custom-table-responsive">
          <table className="table table-bordered table-sm">
            <thead className='thead-light'>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {this.state.openStocks.map((os, i) => (
                <tr key={os.id}>
                  <td>
                    <button className='btn btn-link p-0' onClick={() => this.toggleForm(os)}>{os.opsid}</button>
                  </td>
                  <td>{os.opstype}</td>
                  <td>{os.date}</td>
                  <td>{os.status}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => this.handleDelete(os.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {this.state.openStocks.length === 0 && <tr><td colSpan="5" className="text-center">No records found</td></tr>}
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

export default OpenStockUpdate;