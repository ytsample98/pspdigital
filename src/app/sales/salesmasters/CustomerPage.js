import React, { Component } from 'react';
import { db } from '../../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Dropdown } from 'react-bootstrap';
import '../../../assets/styles/components/_overlay.scss'
import { Country, State, City } from 'country-state-city';

const CLASSIFICATION_OPTIONS = [
  'Manufacturer', 'Subcontract', 'Trader', 'Government Service'
];

const gstStateMap = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "97": "Other Territory"
};

class CustomerPage extends Component {
  state = {
    customers: [],
    showForm: false,
    showPreview: false,
    previewTab: 'showAll',
    showDespatchOverlay: false,
    showPaymentOverlay: false,
    showCurrencyOverlay: false,
    despatchModes: [],
    paymentTerms: [],
    currencies: [],
    overlaySearch: '',
    overlayType: '',
    editingId: null,
    activeTab: 'address',
    formData: {
      custcode: '',//
      custshortName: '',//
      custname: '',//
      classification: CLASSIFICATION_OPTIONS[0],
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      introducedDate: new Date().toISOString().split('T')[0],
      introducedBy: '',
      coHold: false,
      invHold: false,
      address: ['', '', ''],
      country: '', state: '', city: '', zip: '',
      website: '', mail: '', linkedin: '', skype: '',
      despatchMode: '', paymentTerms: '', currency: '', gstin: '', cin: '',
      contacts: [
        { name: '', phone: '', mail: '', skype: '' },
        { name: '', phone: '', mail: '', skype: '' },
        { name: '', phone: '', mail: '', skype: '' }
      ]
    }
  };

  componentDidMount() {
    this.fetchCustomers();
    this.fetchDespatchModes();
    this.fetchPaymentTerms();
    this.fetchCurrencies();
  }
  getPlaceOfSupply = () => {
  const gstin = this.state.formData.gstin || '';
  if (gstin.length >= 2) {
    const code = gstin.substring(0, 2);
    const state = gstStateMap[code];
    if (state) return `${code} - ${state}`;
  }
  return '';
};

  fetchCustomers = async () => {
    const snap = await getDocs(collection(db, 'customers'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ customers: data });
  };

  fetchDespatchModes = async () => {
    const snap = await getDocs(collection(db, 'modes'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ despatchModes: data });
  };

  fetchPaymentTerms = async () => {
    const snap = await getDocs(collection(db, 'paymentTerms'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ paymentTerms: data });
  };

  fetchCurrencies = async () => {
    const snap = await getDocs(collection(db, 'currencies'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ currencies: data });
  };
    
togglePreview = (customer) => {
  this.setState({
    formData: {
      ...customer,
      billTo: {
        address: ['', '', ''],
        country: '',
        state: '',
        city: '',
        zip: '',
        ...(customer.billTo || {})
      },
      shipTo: {
        address: ['', '', ''],
        country: '',
        state: '',
        city: '',
        zip: '',
        ...(customer.shipTo || {})
      }
    },
    showPreview: true,
    showForm: false
  });
};

  toggleForm = (edit = null) => {
     if (edit) {
      this.setState({
        showForm: true,
        editingId: edit.id,
        activeTab: 'address',
        formData: { ...edit },
        showPreview: false
      });
    } else {
      // Auto code generation
      const custcode = `CU${101 + this.state.customers.length}`;
      this.setState({
        showForm: true,
        editingId: null,
        activeTab: 'address',
        showPreview: false,
        formData: {
          custcode,
          custshortName: '',
          custname: '',
          classification: CLASSIFICATION_OPTIONS[0],
          effectiveFrom: new Date().toISOString().split('T')[0],
          effectiveTo: '',
          introducedDate: new Date().toISOString().split('T')[0],
          introducedBy: '',
          coHold: false,
          invHold: false,
          billTo: {
          address: ['', '', ''],
          country: '', state: '', city: '', zip: '',
        },
        shipTo: {
          address: ['', '', ''],
          country: '', state: '', city: '', zip: '',
        },
        sameAsBillTo: false,
          country: '', state: '', city: '', zip: '',
          website: '', mail: '', linkedin: '', skype: '',
          despatchMode: '', paymentTerms: '', currency: '', gstin: '', cin: '',
          contacts: [
            { name: '', phone: '', mail: '', skype: '' },
            { name: '', phone: '', mail: '', skype: '' },
            { name: '', phone: '', mail: '', skype: '' }
          ]
        }
      });
    }
  };

  handleChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleContactChange = (idx, field, value) => {
    const contacts = [...this.state.formData.contacts];
    contacts[idx][field] = value;
    this.handleChange('contacts', contacts);
  };

handleAddressChange = (type, idx, value) => {
  const updated = [...this.state.formData[type].address];
  updated[idx] = value;
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      [type]: { ...prev.formData[type], address: updated }
    }
  }));
};

handleLocationChange = (type, field, value) => {
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      [type]: { ...prev.formData[type], [field]: value }
    }
  }));
};

handleSameAsBillTo = () => {
  this.setState(prev => {
    const { billTo, sameAsBillTo } = prev.formData;
    return {
      formData: {
        ...prev.formData,
        sameAsBillTo: !sameAsBillTo,
        shipTo: !sameAsBillTo ? JSON.parse(JSON.stringify(billTo)) : prev.formData.shipTo
      }
    };
  });
};


  handleCheckbox = (field) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: !prev.formData[field] }
    }));
  };

   handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData } = this.state;
    if (!formData.custshortName || !formData.custname) return alert('Short Name and Customer Name required');
    if (editingId) {
      await setDoc(doc(db, 'customers', editingId), formData);
    } else {
      await addDoc(collection(db, 'customers'), formData);
    }
    this.setState({ showForm: false, showPreview: false, editingId: null });
    this.fetchCustomers();
  };


  handleDelete = async (id) => {
    await deleteDoc(doc(db, 'customers', id));
    this.fetchCustomers();
  };

  showOverlay = (type) => this.setState({ overlayType: type, overlaySearch: '' });
  hideOverlay = () => this.setState({ overlayType: '', overlaySearch: '' });

  selectOverlayValue = (value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [prev.overlayType]: value },
      overlayType: '',
      overlaySearch: ''
    }));
  };

  renderOverlay = () => {
  const { overlayType, overlaySearch, despatchModes, paymentTerms, currencies } = this.state;
  let data = [];
  let label = '';
  let columns = [];
  if (overlayType === 'despatchMode') {
    data = despatchModes;
    label = 'Despatch Mode';
    columns = ['name'];
  } else if (overlayType === 'paymentTerms') {
    data = paymentTerms;
    label = 'Payment Terms';
    columns = ['name'];
  } else if (overlayType === 'currency') {
    data = currencies;
    label = 'Currency';
    columns = ['code', 'name'];
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
                .filter(d => {
                  if (overlayType === 'currency') {
                    return (
                      (d.code && d.code.toLowerCase().includes((overlaySearch || '').toLowerCase())) ||
                      (d.name && d.name.toLowerCase().includes((overlaySearch || '').toLowerCase()))
                    );
                  }
                  return d.name && d.name.toLowerCase().includes((overlaySearch || '').toLowerCase());
                })
                .map((d, i) => (
                  <tr
                    key={d.id || d.code || i}
                    onClick={() =>
                      this.selectOverlayValue(
                        overlayType === 'currency'
                          ? d.code
                          : d.name
                      )
                    }
                    style={{ cursor: 'pointer' }}
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
renderAddressForm = (type) => {
  const data = this.state.formData[type];
  return (
    <>
      <div className="form-row">
        {[0, 1, 2].map(i => (
          <div className="form-group col-md-4" key={i}>
            <label>{`Address Line ${i + 1}`}</label>
            <input
              className="form-control form-control-sm"
              value={data.address[i]}
              onChange={e => this.handleAddressChange(type, i, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="form-row">
        <div className="form-group col-md-3">
          <label>Country</label>
          <select
            className="form-control form-control-sm"
            value={data.country}
            onChange={e => {
              this.handleLocationChange(type, 'country', e.target.value);
              this.handleLocationChange(type, 'state', '');
              this.handleLocationChange(type, 'city', '');
            }}
          >
            <option value="">Select Country</option>
            {Country.getAllCountries().map(c => (
              <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group col-md-3">
          <label>Province/State</label>
          <select
            className="form-control form-control-sm"
            value={data.state}
            onChange={e => {
              this.handleLocationChange(type, 'state', e.target.value);
              this.handleLocationChange(type, 'city', '');
            }}
            disabled={!data.country}
          >
            <option value="">Select State</option>
            {data.country && State.getStatesOfCountry(data.country).map(s => (
              <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group col-md-3">
          <label>City</label>
          <select
            className="form-control form-control-sm"
            value={data.city}
            onChange={e => this.handleLocationChange(type, 'city', e.target.value)}
            disabled={!data.state}
          >
            <option value="">Select City</option>
            {data.country && data.state && City.getCitiesOfState(data.country, data.state).map(city => (
              <option key={city.name} value={city.name}>{city.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group col-md-3">
          <label>Zipcode/Pincode</label>
          <input
            className="form-control form-control-sm"
            value={data.zip}
            onChange={e => this.handleLocationChange(type, 'zip', e.target.value)}
          />
        </div>
      </div>
    </>
  );
};


  renderForm = () => {
    
    const { formData, overlayType, activeTab } = this.state;
    return (
      <div className="card full-height" style={{height:'100vh' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">Customer Creation/Update</h4>
        <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
          <div className="form-row">
            <div className="form-group col-md-2">
              <label>Customer Code</label>
              <input className="form-control form-control-sm" value={formData.custcode} readOnly />
            </div>
            <div className="form-group col-md-2">
              <label>Short Name <span style={{ color: 'red' }}>*</span></label>
              <input className="form-control form-control-sm" value={formData.custshortName} onChange={e => this.handleChange('custshortName', e.target.value)} required />
            </div>
            <div className="form-group col-md-4">
              <label>Customer Name <span style={{ color: 'red' }}>*</span></label>
              <input className="form-control form-control-sm" value={formData.custname} onChange={e => this.handleChange('custname', e.target.value)} required />
            </div>
            <div className="form-group col-md-2">
              <label>Classification</label>
              <select className="form-control form-control-sm" value={formData.classification} onChange={e => this.handleChange('classification', e.target.value)}>
                {CLASSIFICATION_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="form-group col-md-2">
              <label>Introduced Date</label>
              <input className="form-control form-control-sm" type="date" value={formData.introducedDate} onChange={e => this.handleChange('introducedDate', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group col-md-2">
              <label>Effective From</label>
              <input className="form-control form-control-sm" type="date" value={formData.effectiveFrom} onChange={e => this.handleChange('effectiveFrom', e.target.value)} />
            </div>
            <div className="form-group col-md-2">
              <label>Effective To</label>
              <input className="form-control form-control-sm" type="date" value={formData.effectiveTo} onChange={e => this.handleChange('effectiveTo', e.target.value)} />
            </div>
            <div className="form-group col-md-4">
              <label>Introduced By</label>
              <input className="form-control form-control-sm" type="name" value={formData.introducedBy} onChange={e => this.handleChange('introducedBy', e.target.value)} />
            </div>
            <div className="form-group col-md-2 d-flex align-items-center">
              <div className="form-check mr-3">
                <input className="form-check-input" type="checkbox" checked={formData.coHold} onChange={() => this.handleCheckbox('coHold')} id="coHold" />
                <label className="form-check-label" htmlFor="coHold">Customer Order Hold</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked={formData.invHold} onChange={() => this.handleCheckbox('invHold')} id="invHold" />
                <label className="form-check-label" htmlFor="invHold">Invoice Hold</label>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <ul className="nav nav-tabs mt-3" role="tablist">
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'address' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'address' })}>Address</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'terms' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'terms' })}>Commercial Terms</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'contacts' })}>Contact Details</button>
            </li>
          </ul>
                {activeTab === 'address' && (
        <div className="mt-3">
          <h5>Bill To Address</h5>
          {this.renderAddressForm('billTo')}

          <div className="form-check mt-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="sameAsBillTo"
              checked={formData.sameAsBillTo}
              onChange={this.handleSameAsBillTo}
            />
            <label className="form-check-label" htmlFor="sameAsBillTo">Same as Bill To</label>
          </div>

          <h5 className="mt-3">Ship To Address</h5>
          {this.renderAddressForm('shipTo')}

          {/* Place of Supply */}
          {this.getPlaceOfSupply() && (
            <div className="mt-2">
              <b>Place of Supply:</b> {this.getPlaceOfSupply()}
            </div>
          )}
        </div>
      )}
          {activeTab === 'terms' && (
            <div className="mt-3">
              <div className="form-row">
                <div className="form-group col-md-4">
                  <label>Despatch Mode</label>
                  <div className="input-group input-group-sm">
                    <input className="form-control" value={formData.despatchMode} readOnly onClick={() => this.showOverlay('despatchMode')} style={{ background: '#f8f9fa', cursor: 'pointer' }} />
                    <div className="input-group-append">
                      <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => this.showOverlay('despatchMode')}>Select</button>
                    </div>
                  </div>
                </div>
                <div className="form-group col-md-4">
                  <label>Payment Terms</label>
                  <div className="input-group input-group-sm">
                    <input className="form-control" value={formData.paymentTerms} readOnly onClick={() => this.showOverlay('paymentTerms')} style={{ background: '#f8f9fa', cursor: 'pointer' }} />
                    <div className="input-group-append">
                      <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => this.showOverlay('paymentTerms')}>Select</button>
                    </div>
                  </div>
                </div>
                <div className="form-group col-md-4">
                  <label>Currency</label>
                  <div className="input-group input-group-sm">
                    
                    <input className="form-control" value={formData.currency} readOnly onClick={() => this.showOverlay('currency')} style={{ background: '#f8f9fa', cursor: 'pointer' }} />
                    <div className="input-group-append">
                      <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => this.showOverlay('currency')}>Select</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group col-md-4"><label>GSTIN</label><input className="form-control form-control-sm" maxLength={15}  value={formData.gstin} onChange={e => this.handleChange('gstin', e.target.value)} /></div>
                <div className="form-group col-md-4"><label>CIN</label><input className="form-control form-control-sm" value={formData.cin} onChange={e => this.handleChange('cin', e.target.value)} /></div>
              </div>
            </div>
          )}
          {activeTab === 'contacts' && (
            <div className="mt-3">
              {[0, 1, 2].map(i => (
                <div className="form-row" key={i}>
                  <div className="form-group col-md-3"><label>Contact Person</label><input className="form-control form-control-sm" type="name" value={formData.contacts[i].name} onChange={e => this.handleContactChange(i, 'name', e.target.value)} /></div>
                  <div className="form-group col-md-3"><label>Phone</label><input className="form-control form-control-sm" type="number" maxLength={10} value={formData.contacts[i].phone} onChange={e => this.handleContactChange(i, 'phone', e.target.value)} /></div>
                  <div className="form-group col-md-3"><label>Mail</label><input className="form-control form-control-sm" type="email" value={formData.contacts[i].mail} onChange={e => this.handleContactChange(i, 'mail', e.target.value)} /></div>
                  <div className="form-group col-md-3"><label>Skype</label><input className="form-control form-control-sm" value={formData.contacts[i].skype} onChange={e => this.handleContactChange(i, 'skype', e.target.value)} /></div>
                </div>
              ))}
            </div>
          )}
          <div className="fixed-card-footer">
            <button type="submit" className="btn btn-success btn-sm">Save</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ showForm: false })}>Cancel</button>
          </div>
        </form>
        {overlayType && this.renderOverlay()}
      </div>
      </div>
    );
  };
  renderPreview = () => {
    const { formData, previewTab } = this.state;

    const renderRow = (label, value) => (
      <tr>
        <td style={{ width: '30%' }}><strong>{label}</strong></td>
        <td>{value || '-'}</td>
      </tr>
    );

    const renderContact = () => (
      <table className="table table-bordered table-sm">
        <tbody>
          {(formData.contacts || []).map((c, i) => (
            <React.Fragment key={i}>
              {renderRow(`Contact Person ${i + 1}`, c.name)}
              {renderRow('Phone', c.phone)}
              {renderRow('Mail', c.mail)}
              {renderRow('Skype', c.skype)}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    );

    const renderAddress = () => (
      <>
        <h6 className="mt-2">Bill To Address</h6>
        <table className="table table-bordered table-sm">
          <tbody>
            {[0, 1, 2].map(i => renderRow(`Line ${i + 1}`, formData.billTo?.address[i]))}
            {renderRow('Country', formData.billTo?.country)}
            {renderRow('State', formData.billTo?.state)}
            {renderRow('City', formData.billTo?.city)}
            {renderRow('Zip', formData.billTo?.zip)}
          </tbody>
        </table>

        <h6 className="mt-2">Ship To Address</h6>
        <table className="table table-bordered table-sm">
          <tbody>
            {[0, 1, 2].map(i => renderRow(`Line ${i + 1}`, formData.shipTo?.address[i]))}
            {renderRow('Country', formData.shipTo?.country)}
            {renderRow('State', formData.shipTo?.state)}
            {renderRow('City', formData.shipTo?.city)}
            {renderRow('Zip', formData.shipTo?.zip)}
          </tbody>
        </table>
        {this.getPlaceOfSupply() && (
        <div className="mt-2">
          <b>Place of Supply:</b> {this.getPlaceOfSupply()}
        </div>
      )}
      </>
    );

    const renderTerms = () => (
      <table className="table table-bordered table-sm">
        <tbody>
          {renderRow('Despatch Mode', formData.despatchMode)}
          {renderRow('Payment Terms', formData.paymentTerms)}
          {renderRow('Currency', formData.currency)}
          {renderRow('GSTIN', formData.gstin)}
          {renderRow('CIN', formData.cin)}
        </tbody>
      </table>
    );

    const tabContent = () => {
      switch (previewTab) {
        case 'contact': return renderContact();
        case 'address': return renderAddress();
        case 'terms': return renderTerms();
        case 'showAll':
        default:
          return <>{renderAddress()}<hr />{renderContact()}<hr />{renderTerms()}</>;
      }
    };

    return (
      <div className="card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">Customer Preview</h4>
          <div>
            <button className="btn btn-outline-primary btn-sm mr-2" onClick={() => this.toggleForm(formData)}>View / Edit</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => this.setState({ showPreview: false })}>Back to List</button>
          </div>
        </div>

        <table className="table table-bordered table-sm mb-4">
          <tbody>
            {renderRow('Code', formData.custcode)}
            {renderRow('Short Name', formData.custshortName)}
            {renderRow('Name', formData.custname)}
            {renderRow('Classification', formData.classification)}
            {renderRow('Introduced Date', formData.introducedDate)}
            {renderRow('Introduced By', formData.introducedBy)}
            {renderRow('Effective From', formData.effectiveFrom)}
            {renderRow('Effective To', formData.effectiveTo)}
            {renderRow('CO Hold', formData.coHold ? 'Yes' : 'No')}
            {renderRow('INV Hold', formData.invHold ? 'Yes' : 'No')}
          </tbody>
        </table>

        <ul className="nav nav-tabs mb-3">
          {['showAll', 'address', 'contact', 'terms'].map(key => (
            <li className="nav-item" key={key}>
              <button
                className={`nav-link ${previewTab === key ? 'active' : ''}`}
                onClick={() => this.setState({ previewTab: key })}
              >
                {key === 'showAll' ? 'Show All' : key.charAt(0).toUpperCase() + key.slice(1).replace('terms', 'Commercial Terms')}
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
          <h4 className="card-title">Customers</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>+ Add Customer</button>
        </div>
        <div className="custom-table-responsive">
          <table className="table table-bordered table-sm">
            <thead className='thead-light'>
              <tr>
                <th>Code</th>
                <th>Customer Name</th>
                <th>Short Name</th>
                <th>Classification</th>
                <th>Intro Date</th>
                <th>Intro By</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>CO Hold</th>
                <th>Inv Hold</th>
                <th>Tax</th>
                <th>Currency</th>
              </tr>
            </thead>
            <tbody>
              {this.state.customers.map((c, i) => (
                <tr key={c.id}>
                  <td><button className='btn btn-link p-0' onClick={() => this.togglePreview(c)}>{c.custcode}</button></td>
                  <td>{c.custname}</td>
                  <td>{c.custshortName}</td>
                  <td>{c.classification}</td>
                  <td>{c.introducedDate}</td>
                  <td>{c.introducedBy}</td>
                  <td>{c.effectiveFrom}</td>
                  <td>{c.effectiveTo}</td>
                  <td>{c.coHold ? 'Yes' : 'No'}</td>
                  <td>{c.invHold ? 'Yes' : 'No'}</td>
                  <td>{c.gstin}</td>
                  <td>{c.currency}</td>
                </tr>
              ))}
              {this.state.customers.length === 0 && <tr><td colSpan="13" className="text-center">No records found</td></tr>}
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

export default CustomerPage;