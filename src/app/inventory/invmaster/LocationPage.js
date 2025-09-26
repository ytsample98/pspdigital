import React, { Component } from 'react';
import { db } from '../../../firebase';import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import '../../../assets/styles/components/_custom-table.scss';
import { Country, State, City } from 'country-state-city';
const TYPE_OPTIONS = ['Global', 'Local'];


class LocationPage extends Component {
  state = {
    locations: [],
    showForm: false,
    editingId: null,
    activeTab: 'address',
    formData: {
      name: '',
      type: 'Local',
      inactiveDate: '',
      sameAsShip: true,
      description: '',
      shipToLocation: '',
      showLocationOverlay: false,
      locationSearch: '',
      // Address
      no: '', building: '', road: '', area: '', country: '', state: '', city: '',
      // Contact
      landline: '', fax: '', mobile: '', email: '',
      // Shipping details
      contactPerson: '',
      shipToSite: true, receivingSite: true, officeSite: true, internalSite: true, billToSite: true,
    }
  };

  componentDidMount() {
    this.fetchLocations();
  }

  fetchLocations = async () => {
    const snap = await getDocs(collection(db, 'locations'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ locations: data });
  };

  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({ showForm: true, editingId: edit.id, activeTab: 'address', formData: { ...edit } });
    } else {
      this.setState({
        showForm: true,
        editingId: null,
        activeTab: 'address',
        formData: {
          name: '',
          type: 'Local',
          inactiveDate: '',
          sameAsShip: true,
          description: '',
          shipToLocation: '',
          no: '', building: '', road: '', area: '', country: '', state: '', city: '',
          landline: '', fax: '', mobile: '', email: '',
          contactPerson: '',
          shipToSite: true, receivingSite: true, officeSite: true, internalSite: true, billToSite: true,
        }
      });
    }
  };

  handleChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleCheckbox = (field) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: !prev.formData[field] }
    }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData } = this.state;
    if (!formData.name) return alert('Enter name');
    if (editingId) {
      await setDoc(doc(db, 'locations', editingId), formData);
    } else {
      await addDoc(collection(db, 'locations'), formData);
    }
    this.setState({ showForm: false, editingId: null });
    this.fetchLocations();
  };

  renderForm = () => {
    const { formData, activeTab } = this.state;
    return (
      <div className="card full-height">
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">Location</h4>
        <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
          <div className="form-row">
            <div className="form-group col-md-3">
              <label>Name</label>
              <input className="form-control form-control-sm" value={formData.name} onChange={e => this.handleChange('name', e.target.value)} required />
            </div>
            <div className="form-group col-md-3">
              <label>Type</label>
              <select className="form-control form-control-sm" value={formData.type} onChange={e => this.handleChange('type', e.target.value)}>
                {TYPE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="form-group col-md-3">
              <label>Inactive Date</label>
              <input className="form-control form-control-sm" type="date" value={formData.inactiveDate} onChange={e => this.handleChange('inactiveDate', e.target.value)} />
            </div>
            <div className="form-group col-md-3 d-flex align-items-center">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked={formData.sameAsShip} onChange={() => this.handleCheckbox('sameAsShip')} id="sameAsShip" />
                <label className="form-check-label" htmlFor="sameAsShip">Same as Ship To</label>
              </div>
            </div>
          </div>
       {!formData.sameAsShip && (
  <div className="form-row">
    <div className="form-group col-md-6">
      <label>Ship To Location</label>
      <div className="position-relative">
        <input
          type="text"
          className="form-control form-control-sm"
          value={formData.shipToLocation}
          placeholder="Select Ship To Location"
          readOnly
          onClick={() => this.setState({ showLocationOverlay: true, locationSearch: '' })}
        />

        {/* Overlay */}
        {this.state.showLocationOverlay && (
          <div className="overlay-select-box">
            <div className="overlay-header d-flex justify-content-between align-items-center">
              <strong>Select Location</strong>
              <button
                type="button"
                className="close btn btn-sm"
                onClick={() => this.setState({ showLocationOverlay: false })}
              >
                ×
              </button>
            </div>

            <div className="overlay-body">
              <input
                type="text"
                className="form-control form-control-sm mb-2"
                placeholder="Search location..."
                value={this.state.locationSearch || ''}
                onChange={(e) => this.setState({ locationSearch: e.target.value })}
              />
              <ul className="list-group" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {this.state.locations
                  .filter((loc) =>
                    loc.name.toLowerCase().includes((this.state.locationSearch || '').toLowerCase())
                  )
                  .map((loc) => (
                    <li
                      key={loc.id}
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        this.handleChange('shipToLocation', loc.name);
                        this.setState({ showLocationOverlay: false });
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {loc.name}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}


          <div className="form-row">
            <div className="form-group col-md-12">
              <label>Description</label>
              <input className="form-control form-control-sm" value={formData.description} onChange={e => this.handleChange('description', e.target.value)} />
            </div>
          </div>
          {/* Tabs */}
          <ul className="nav nav-tabs mt-3" role="tablist">
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'address' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'address' })}>Address</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'contact' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'contact' })}>Contact</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'shipping' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'shipping' })}>Shipping Details</button>
            </li>
          </ul>
          {activeTab === 'address' && (
            <>
            <div className="form-row mt-3">
  <div className="form-group col-md-2">
    <label>No</label>
    <input className="form-control form-control-sm" value={formData.no} onChange={e => this.handleChange('no', e.target.value)} />
  </div>
  <div className="form-group col-md-2">
    <label>Building Name/Village</label>
    <input className="form-control form-control-sm" value={formData.building} onChange={e => this.handleChange('building', e.target.value)} />
  </div>
  <div className="form-group col-md-2">
    <label>Road/Street</label>
    <input className="form-control form-control-sm" value={formData.road} onChange={e => this.handleChange('road', e.target.value)} />
  </div>
  <div className="form-group col-md-2">
    <label>Area/Taluk</label>
    <input className="form-control form-control-sm" value={formData.area} onChange={e => this.handleChange('area', e.target.value)} />
  </div>
</div>
<div className="form-row">
  <div className="form-group col-md-4">
    <label>Country</label>
    <select
      className="form-control form-control-sm"
      value={formData.country}
      onChange={e => {
        const countryCode = e.target.value;
        this.handleChange('country', countryCode);
        this.handleChange('state', '');
        this.handleChange('city', '');
      }}
    >
      <option value="">Select Country</option>
      {Country.getAllCountries().map(c => (
        <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
      ))}
    </select>
  </div>
  <div className="form-group col-md-4">
    <label>Province/State</label>
    <select
      className="form-control form-control-sm"
      value={formData.state}
      onChange={e => {
        const stateCode = e.target.value;
        this.handleChange('state', stateCode);
        this.handleChange('city', '');
      }}
      disabled={!formData.country}
    >
      <option value="">Select State</option>
      {formData.country &&
        State.getStatesOfCountry(formData.country).map(s => (
          <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
        ))}
    </select>
  </div>
  <div className="form-group col-md-4">
    <label>City</label>
    <select
      className="form-control form-control-sm"
      value={formData.city}
      onChange={e => this.handleChange('city', e.target.value)}
      disabled={!formData.state}
    >
      <option value="">Select City</option>
      {formData.country && formData.state &&
        City.getCitiesOfState(formData.country, formData.state).map(city => (
          <option key={city.name} value={city.name}>{city.name}</option>
        ))}
    </select>
  </div>
</div>
</>
          )}
          {activeTab === 'contact' && (
            <div className="form-row mt-3">
              <div className="form-group col-md-3"><label>Landline</label><input className="form-control form-control-sm" value={formData.landline} onChange={e => this.handleChange('landline', e.target.value)} /></div>
              <div className="form-group col-md-3"><label>Fax</label><input className="form-control form-control-sm" value={formData.fax} onChange={e => this.handleChange('fax', e.target.value)} /></div>
              <div className="form-group col-md-3"><label>Mobile Number</label><input className="form-control form-control-sm" value={formData.mobile} onChange={e => this.handleChange('mobile', e.target.value)} /></div>
              <div className="form-group col-md-3"><label>Email</label><input className="form-control form-control-sm" value={formData.email} onChange={e => this.handleChange('email', e.target.value)} /></div>
            </div>
          )}
          {activeTab === 'shipping' && (
            <div className="form-row mt-3">
              <div className="form-group col-md-4"><label>Contact Person</label><input className="form-control form-control-sm" value={formData.contactPerson} onChange={e => this.handleChange('contactPerson', e.target.value)} /></div>
              <div className="form-group col-md-8 d-flex align-items-center">
                <div className="form-check mr-3">
                  <input className="form-check-input" type="checkbox" checked={formData.shipToSite} onChange={() => this.handleCheckbox('shipToSite')} id="shipToSite" />
                  <label className="form-check-label" htmlFor="shipToSite">Ship to Site</label>
                </div>
                <div className="form-check mr-3">
                  <input className="form-check-input" type="checkbox" checked={formData.receivingSite} onChange={() => this.handleCheckbox('receivingSite')} id="receivingSite" />
                  <label className="form-check-label" htmlFor="receivingSite">Receiving Site</label>
                </div>
                <div className="form-check mr-3">
                  <input className="form-check-input" type="checkbox" checked={formData.officeSite} onChange={() => this.handleCheckbox('officeSite')} id="officeSite" />
                  <label className="form-check-label" htmlFor="officeSite">Office Site</label>
                </div>
                <div className="form-check mr-3">
                  <input className="form-check-input" type="checkbox" checked={formData.internalSite} onChange={() => this.handleCheckbox('internalSite')} id="internalSite" />
                  <label className="form-check-label" htmlFor="internalSite">Internal Site</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" checked={formData.billToSite} onChange={() => this.handleCheckbox('billToSite')} id="billToSite" />
                  <label className="form-check-label" htmlFor="billToSite">Bill to Site</label>
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

  handleDelete = async (id) => {
    await deleteDoc(doc(db, 'locations', id));
    this.fetchLocations();
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Locations</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>+ Add Location</button>
        </div>
        <div className="custom-table-responsive">
        <table className="table table-bordered table-sm">
          <thead className='thead-light'>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Inactive Date</th>
              <th>Same as Ship To</th>
            </tr>
          </thead>
          <tbody>
            {this.state.locations.map((l, i) => (
              <tr key={l.id}>
                <td><button className='btn btn-link p-0' onClick={() => this.toggleForm(l)}>{l.name}</button></td>
                <td>{l.type}</td>
                <td>{l.inactiveDate}</td>
                <td>{l.sameAsShip ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {this.state.locations.length === 0 && <tr><td colSpan="5" className="text-center">No records found</td></tr>}
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

export default LocationPage;