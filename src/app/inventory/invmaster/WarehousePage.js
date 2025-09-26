import React, { Component } from 'react';
import { db } from '../../../firebase';import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import '../../../assets/styles/components/_custom-table.scss';

const TYPE_OPTIONS = ['Global', 'Local'];

class WarehousePage extends Component {
  state = {
    warehouses: [],
    locations: [],
    showForm: false,
    editingId: null,
    activeTab: 'contact',
    formData: {
      code: '',
      name: '',
      location: '',
      type: 'Local',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      description: '',
      // Contact Info
      landline: '', mobile: '', fax: '', email: '',
      // Contact Person
      person1: '', person1Mobile: '', person1Email: '',
      person2: '', person2Mobile: '', person2Email: '',
      person3: '', person3Mobile: '', person3Email: '',
      // Others
      pan: '', gstin: ''
    }
  };

  componentDidMount() {
    this.fetchWarehouses();
    this.fetchLocations();
  }

  fetchWarehouses = async () => {
    const snap = await getDocs(collection(db, 'warehouses'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ warehouses: data });
  };

  fetchLocations = async () => {
    const snap = await getDocs(collection(db, 'locations'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ locations: data });
  };

  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({ showForm: true, editingId: edit.id, activeTab: 'contact', formData: { ...edit } });
    } else {
      this.setState({
        showForm: true,
        editingId: null,
        activeTab: 'contact',
        formData: {
          code:'',
          name: '',
          location: '',
          type: 'Local',
          effectiveFrom: new Date().toISOString().split('T')[0],
          effectiveTo: '',
          description: '',
          landline: '', mobile: '', fax: '', email: '',
          person1: '', person1Mobile: '', person1Email: '',
          person2: '', person2Mobile: '', person2Email: '',
          person3: '', person3Mobile: '', person3Email: '',
          pan: '', gstin: ''
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
    if (!formData.name) return alert('Enter warehouse name');
    if (editingId) {
      await setDoc(doc(db, 'warehouses', editingId), formData);
    } else {
      await addDoc(collection(db, 'warehouses'), formData);
    }
    this.setState({ showForm: false, editingId: null });
    this.fetchWarehouses();
  };

  handleDelete = async (id) => {
    await deleteDoc(doc(db, 'warehouses', id));
    this.fetchWarehouses();
  };

  renderForm = () => {
    const { formData, activeTab, locations } = this.state;
    return (
      <div className="card p-3 mt-3">
        <h4 className="mb-3">Warehouse Creation</h4>
        <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
          <div className="form-row">
            <div className="form-group col-md-2">
              <label>Code</label>
             <input
              className="form-control form-control-sm"
              value={formData.code}
              onChange={e => this.handleChange('code', e.target.value)}
              required
            />
            </div>
            <div className="form-group col-md-3">
              <label>Name</label>
              <input className="form-control form-control-sm" value={formData.name} onChange={e => this.handleChange('name', e.target.value)} required />
            </div>
            <div className="form-group col-md-3">
              <label>Location</label>
              <select className="form-control form-control-sm" value={formData.location} onChange={e => this.handleChange('location', e.target.value)}>
                <option value="">Select</option>
                {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group col-md-2">
              <label>Type</label>
              <select className="form-control form-control-sm" value={formData.type} onChange={e => this.handleChange('type', e.target.value)}>
                {TYPE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group col-md-8">
              <label>Description</label>
              <input className="form-control form-control-sm" value={formData.description} onChange={e => this.handleChange('description', e.target.value)} />
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
          {/* Tabs */}
          <ul className="nav nav-tabs mt-3" role="tablist">
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'contact' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'contact' })}>Contact Info</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'person' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'person' })}>Contact Person</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'others' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'others' })}>Others</button>
            </li>
          </ul>
          {activeTab === 'contact' && (
            <div className="form-row mt-3">
              <div className="form-group col-md-3"><label>Landline</label><input className="form-control form-control-sm" value={formData.landline} onChange={e => this.handleChange('landline', e.target.value)} /></div>
              <div className="form-group col-md-3"><label>Mobile No</label><input className="form-control form-control-sm" value={formData.mobile} onChange={e => this.handleChange('mobile', e.target.value)} /></div>
              <div className="form-group col-md-3"><label>Fax</label><input className="form-control form-control-sm" value={formData.fax} onChange={e => this.handleChange('fax', e.target.value)} /></div>
              <div className="form-group col-md-3"><label>Email</label><input className="form-control form-control-sm" value={formData.email} onChange={e => this.handleChange('email', e.target.value)} /></div>
            </div>
          )}
          {activeTab === 'person' && (
            <div className="form-row mt-3">
              {[1, 2, 3].map(n => (
                <React.Fragment key={n}>
                  <div className="form-group col-md-4">
                    <label>Name {n}</label>
                    <input className="form-control form-control-sm" value={formData[`person${n}`]} onChange={e => this.handleChange(`person${n}`, e.target.value)} />
                  </div>
                  <div className="form-group col-md-4">
                    <label>Mobile {n}</label>
                    <input className="form-control form-control-sm" value={formData[`person${n}Mobile`]} onChange={e => this.handleChange(`person${n}Mobile`, e.target.value)} />
                  </div>
                  <div className="form-group col-md-4">
                    <label>Email {n}</label>
                    <input className="form-control form-control-sm" value={formData[`person${n}Email`]} onChange={e => this.handleChange(`person${n}Email`, e.target.value)} />
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          {activeTab === 'others' && (
            <div className="form-row mt-3">
              <div className="form-group col-md-6"><label>PAN</label><input className="form-control form-control-sm" value={formData.pan} onChange={e => this.handleChange('pan', e.target.value)} /></div>
              <div className="form-group col-md-6"><label>GSTIN</label><input className="form-control form-control-sm" value={formData.gstin} onChange={e => this.handleChange('gstin', e.target.value)} /></div>
            </div>
          )}
          <div className="d-flex justify-content-between mt-3">
            <button type="submit" className="btn btn-success btn-sm">Save</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ showForm: false })}>Cancel</button>
          </div>
        </form>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Warehouses</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>+ Add Warehouse</button>
        </div>
        <div className="custom-table-responsive">
        <table className="table table-bordered table-sm">
          <thead className='thead-light'>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Location</th>
              <th>Type</th>
              <th>Effective From</th>
              <th>Effective To</th>
            </tr>
          </thead>
          <tbody>
            {this.state.warehouses.map((w, i) => (
              <tr key={w.id}>
                <td><button className='btn btn-link p-0' onClick={() => this.toggleForm(w)} >{w.code}</button></td>
                <td>{w.name}</td>
                <td>{w.location}</td>
                <td>{w.type}</td>
                <td>{w.effectiveFrom}</td>
                <td>{w.effectiveTo}</td>
              </tr>
            ))}
            {this.state.warehouses.length === 0 && <tr><td colSpan="7" className="text-center">No records found</td></tr>}
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

export default WarehousePage;