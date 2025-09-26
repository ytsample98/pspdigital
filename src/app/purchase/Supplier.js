import React, { Component } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dropdown } from 'react-bootstrap';
import '../../assets/styles/components/_overlay.scss';
import { Country, State, City } from 'country-state-city';

const FY_OPTIONS = ['Jan-Dec', 'Apr-Mar'];
const STATUS_OPTIONS = ['Active', 'In-Active'];
const LEDGER_OPTIONS = ['Ledger1', 'Ledger2'];
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


class SupplierPage extends Component {
  state = {
    supp: [],
    supplier: null,
    showForm: false,
    showPreview:false,
    previewTab: 'showAll',
    editingId: null,
    activeTab: 'reg',
    formData: {
      spCode: '',
      spshortName: '',
      spName: '',
      effectiveFrom: '',
      establishedFrom: '',
      industry: '',
      primaryLedger: LEDGER_OPTIONS[0],
      status: 'Active',
      financialYear: FY_OPTIONS[0],
      currency: '',
      landline: '', mobile: '', fax: '', email: '', website: '', linkedin: '', skype: '', twitter: '',
      address: '', country: '', state: '', city: '',
      regNo: '', regPlace: '', pan: '', gstin: '',
      banks: [],
      bankEditIndex: null,
      bankName: '', branchName: '', ifsc: '', accountNo: '', accountHolder: ''
    }
  };
  handleAddNewSupplier = () => {
  this.setState({
    showForm: true,
    showPreview: false,
    editingId: null,
    supplier: null,
    activeTab: 'reg',
    formData: {
      spCode: '',
      spshortName: '',
      spName: '',
      effectiveFrom: '',
      establishedFrom: '',
      industry: '',
      primaryLedger: LEDGER_OPTIONS[0],
      status: 'Active',
      financialYear: FY_OPTIONS[0],
      currency: '',
      landline: '', mobile: '', fax: '', email: '', website: '', linkedin: '', skype: '', twitter: '',
      address: '', country: '', state: '', city: '',
      regNo: '', regPlace: '', pan: '', gstin: '',
      banks: [],
      bankEditIndex: null,
      bankName: '', branchName: '', ifsc: '', accountNo: '', accountHolder: '',
      
    }
  });
};


  componentDidMount() {
    this.fetchsupp();
  }

  fetchsupp = async () => {
    const snap = await getDocs(collection(db, 'suppliers'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ supp: data, supplier: data[0] || null });
  };
  toggleForm = () => {
  const { supplier } = this.state;
  if (!supplier) return;
  this.setState({
    showForm: true,
    showPreview: false,
    editingId: supplier.id,
    activeTab: 'reg',
    formData: { ...supplier, bankEditIndex: null}
  });
};
togglePreview = (org) => {
  this.setState({ supplier: org, showPreview: true, showForm: false });
};
loadQuotePreview = (q) => {
  this.setState({
    selectedQuote: q,
    previewMode: true
  });
};


  handleChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleBankChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleBankAddOrUpdate = () => {
    const { bankName, branchName, ifsc, accountNo, accountHolder, banks, bankEditIndex } = this.state.formData;
    if (!bankName || !accountNo) return alert('Bank Name and Account No required');
    let newBank = { bankName, branchName, ifsc, accountNo, accountHolder };
    let newBanks = [...banks];
    if (bankEditIndex !== null) {
      newBanks[bankEditIndex] = newBank;
    } else {
      newBanks.push(newBank);
    }
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        banks: newBanks,
        bankEditIndex: null,
        bankName: '', branchName: '', ifsc: '', accountNo: '', accountHolder: ''
      }
    }));
  };

  handleBankEdit = (idx) => {
    const bank = this.state.formData.banks[idx];
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        bankEditIndex: idx,
        bankName: bank.bankName,
        branchName: bank.branchName,
        ifsc: bank.ifsc,
        accountNo: bank.accountNo,
        accountHolder: bank.accountHolder
      }
    }));
  };


componentDidMount() {
  this.fetchsupp();
  this.fetchCurrencies();
}

fetchCurrencies = async () => {
  const snap = await getDocs(collection(db, 'currencies'));
  const currencyList = snap.docs.map(doc => doc.data()); // includes { code, name }
  this.setState(prev => ({
    currencyOptions: currencyList,
    formData: { ...prev.formData, currency: prev.formData.currency || currencyList[0]?.code || '' }
  }));
};


handleSubmit = async (e) => {
  e.preventDefault();
  const { editingId, formData } = this.state;

  if (!formData.spshortName || !formData.spName) {
    return alert('Short Name and Supplier Name required');
  }

  try {
    if (editingId) {
      await setDoc(doc(db, 'suppliers', editingId), formData);
    } else {
      await addDoc(collection(db, 'suppliers'), formData);
    }

    this.setState({ showForm: false, showPreview: false, editingId: null });
    this.fetchsupp();
  } catch (error) {
    console.error("Failed to save supplier:", error);
    alert("Failed to save supplier. Please try again.");
  }
};




  renderForm = () => {
    const { formData, activeTab } = this.state;
    const nextCode = `SUP${(this.state.supp.length + 1).toString().padStart(3, '0')}`;
    formData.spCode = nextCode;
    return (
      <div className="card full-height">
         <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">Supplier Creation/Update</h4>
        <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
          <div className="form-row">
            <div className="form-group col-md-2"><label>Supplier Code</label><input className="form-control form-control-sm" value={formData.spCode} readOnly /></div>
            <div className="form-group col-md-2"><label>Short Name *</label><input className="form-control form-control-sm" value={formData.spshortName} onChange={e => this.handleChange('spshortName', e.target.value)} required /></div>
            <div className="form-group col-md-4"><label>Supplier Name *</label><input className="form-control form-control-sm" value={formData.spName} onChange={e => this.handleChange('spName', e.target.value)} required /></div>
            <div className="form-group col-md-2"><label>Established From *</label><input className="form-control form-control-sm" type="date" value={formData.establishedFrom} onChange={e => this.handleChange('establishedFrom', e.target.value)}  required/></div>
            <div className="form-group col-md-2"><label>Effective From *</label><input className="form-control form-control-sm" type="date" value={formData.effectiveFrom} onChange={e => this.handleChange('effectiveFrom', e.target.value)}  required/></div>
          </div>
          <div className="form-row">
            <div className="form-group col-md-3"><label>Industry</label><input className="form-control form-control-sm" value={formData.industry} onChange={e => this.handleChange('industry', e.target.value)} /></div>
            <div className="form-group col-md-2"><label>Primary Ledger *</label>
              <select className="form-control form-control-sm" value={formData.primaryLedger} onChange={e => this.handleChange('primaryLedger', e.target.value)} required>
                {LEDGER_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="form-group col-md-2"><label>Status</label>
              <div>
                {STATUS_OPTIONS.map(opt => (
                  <label key={opt} className="mr-2">
                    <input type="radio" name="status" checked={formData.status === opt} onChange={() => this.handleChange('status', opt)} /> {opt}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group col-md-3"><label>Financial Year Start *</label>
              <select className="form-control form-control-sm" value={formData.financialYear} onChange={e => this.handleChange('financialYear', e.target.value)} required>
                {FY_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            
            <div className="form-group col-md-2"><label>Currency</label>
            <select
              className="form-control form-control-sm"
              value={formData.currency}
              onChange={e => this.handleChange('currency', e.target.value)}
            >
              <option value="">Select Currency</option>
              {this.state.currencyOptions.map(cur => (
                <option key={cur.code} value={cur.code}>
                  {cur.code} - {cur.name}
                </option>
              ))}
            </select>
</div>
          </div>
          {/* Tabs */}
          <ul className="nav nav-tabs mt-3" role="tablist">
             <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'reg' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'reg' })}>Registration Details</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'address' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'address' })}>Address</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'contact' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'contact' })}>Contact Info</button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === 'bank' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'bank' })}>Bank Details</button>
            </li>
          </ul>
          {activeTab === 'reg' && (
            <div className="mt-3">
              <div className="form-row">
                <div className="form-group col-md-3"><label>Company Inc Reg Number *</label><input className="form-control form-control-sm" value={formData.regNo} onChange={e => this.handleChange('regNo', e.target.value)} required/></div>
                <div className="form-group col-md-3"> <label>GSTIN *</label>
                <input
                className="form-control form-control-sm"
                value={formData.gstin}
                onChange={e => {
                  const gstin = e.target.value;
                  this.handleChange('gstin', gstin);

                  if (gstin.length >= 2) {
                    const stateCode = gstin.substring(0, 2);
                    const place = gstStateMap[stateCode];
                    if (place) {
                      this.handleChange('regPlace', place);
                    }
                  }
                }}
                required
              />
               </div>
                <div className="form-group col-md-3"><label>Place of Registration *</label><input className="form-control form-control-sm" value={formData.regPlace} required /></div>
                <div className="form-group col-md-3"><label>PAN *</label><input className="form-control form-control-sm" value={formData.pan} onChange={e => this.handleChange('pan', e.target.value)} required /></div>
              </div>
            </div>
          )}
          {activeTab === 'address' && (
            <div className="mt-3">
              <div className="form-row">
                <div className="form-group col-md-6"><label>Address Line *</label><input className="form-control form-control-sm" value={formData.address} onChange={e => this.handleChange('address', e.target.value)} required /></div>
                  <div className="form-group col-md-2">
                    <label>Country *</label>
                    <select
                      className="form-control form-control-sm"
                      value={formData.country}
                      onChange={e => {
                        const countryCode = e.target.value;
                        this.handleChange('country', countryCode);
                        this.handleChange('state', '');
                        this.handleChange('city', '');
                      }}
                      required
                    >
                      <option value="">Select Country</option>
                      {Country.getAllCountries().map(c => (
                        <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                
                  <div className="form-group col-md-2">
                    <label>Province/State *</label>
                    <select
                      className="form-control form-control-sm"
                      value={formData.state}
                      onChange={e => {
                        const stateCode = e.target.value;
                        this.handleChange('state', stateCode);
                        this.handleChange('city', '');
                      }}
                      disabled={!formData.country}
                      required
                    >
                      <option value="">Select State</option>
                      {formData.country &&
                        State.getStatesOfCountry(formData.country).map(s => (
                          <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                        ))}
                    </select>
                  </div>
                
                  <div className="form-group col-md-2">
                    <label>City *</label>
                    <select
                      className="form-control form-control-sm"
                      value={formData.city}
                      onChange={e => this.handleChange('city', e.target.value)}
                      disabled={!formData.state}
                      required
                    >
                      <option value="">Select City</option>
                      {formData.country && formData.state &&
                        City.getCitiesOfState(formData.country, formData.state).map(city => (
                          <option key={city.name} value={city.name}>{city.name}</option>
                        ))}
                    </select>
                  </div>
                
               </div>
            </div>
          )}
          
          {activeTab === 'contact' && (
            <div className="mt-3">
              <div className="form-row">
                <div className="form-group col-md-3"><label>Landline *</label><input type="number" className="form-control form-control-sm" value={formData.landline} onChange={e => this.handleChange('landline', e.target.value)} required /></div>
                <div className="form-group col-md-3"><label>Mobile No *</label><input type="number" maxLength={10} className="form-control form-control-sm" value={formData.mobile} onChange={e => this.handleChange('mobile', e.target.value)} required/></div>
                <div className="form-group col-md-3"><label>Fax</label><input type="number" maxLength={10} className="form-control form-control-sm" value={formData.fax} onChange={e => this.handleChange('fax', e.target.value)} /></div>
                <div className="form-group col-md-3"><label>E-Mail *</label><input type= "email" className="form-control form-control-sm" value={formData.email} onChange={e => this.handleChange('email', e.target.value)} required/></div>
              </div>
              <div className="form-row">
                <div className="form-group col-md-3"><label>Website *</label><input type="website" className="form-control form-control-sm" value={formData.website} onChange={e => this.handleChange('website', e.target.value)} required/></div>
                <div className="form-group col-md-3"><label>LinkedIn *</label><input type="link" className="form-control form-control-sm" value={formData.linkedin} onChange={e => this.handleChange('linkedin', e.target.value)} required/></div>
                <div className="form-group col-md-3"><label>Skype</label><input type="link" className="form-control form-control-sm" value={formData.skype} onChange={e => this.handleChange('skype', e.target.value)} /></div>
                <div className="form-group col-md-3"><label>Twitter</label><input type="link" className="form-control form-control-sm" value={formData.twitter} onChange={e => this.handleChange('twitter', e.target.value)} /></div>
              </div>
            </div>
          )}
          {activeTab === 'bank' && (
            <div className="mt-3">
              <div className="form-row">
                <div className="form-group col-md-2"><label>Bank Name </label><input className="form-control form-control-sm" type="name" value={formData.bankName} onChange={e => this.handleBankChange('bankName', e.target.value)}  /></div>
                <div className="form-group col-md-2"><label>Branch Name </label><input className="form-control form-control-sm" type="name" value={formData.branchName} onChange={e => this.handleBankChange('branchName', e.target.value)} /></div>
                <div className="form-group col-md-2"><label>IFSC Code </label><input className="form-control form-control-sm"  value={formData.ifsc} onChange={e => this.handleBankChange('ifsc', e.target.value)} /></div>
                <div className="form-group col-md-2"><label>Account No </label><input className="form-control form-control-sm" type="number"  value={formData.accountNo} onChange={e => this.handleBankChange('accountNo', e.target.value)} /></div>
                <div className="form-group col-md-2"><label>Account Holder </label><input className="form-control form-control-sm" type="name"  value={formData.accountHolder} onChange={e => this.handleBankChange('accountHolder', e.target.value)}  /></div>
                <div className="form-group col-md-2 d-flex align-items-end">
                  <button type="button" className="btn btn-primary btn-sm" style={{ minWidth: 100 }} onClick={this.handleBankAddOrUpdate}>
                    {formData.bankEditIndex !== null ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
              <div className="custom-table-responsive">
                <table className="table table-bordered table-sm mt-2">
                  <thead>
                    <tr>
                      <th>Edit</th>
                      <th>Bank Name</th>
                      <th>Branch Name</th>
                      <th>IFSC</th>
                      <th>Account No</th>
                      <th>Account Holder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.banks.map((b, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="radio"
                            name="editBank"
                            checked={formData.bankEditIndex === idx}
                            onChange={() => this.handleBankEdit(idx)}
                          />
                        </td>
                        <td>{b.bankName}</td>
                        <td>{b.branchName}</td>
                        <td>{b.ifsc}</td>
                        <td>{b.accountNo}</td>
                        <td>{b.accountHolder}</td>
                      </tr>
                    ))}
                    {formData.banks.length === 0 && <tr><td colSpan="6" className="text-center">No banks</td></tr>}
                  </tbody>
                </table>
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
renderPreview = () => {
  const { supplier, previewTab } = this.state;
  if (!supplier) return null;

  const renderRow = (label, value) => (
    <tr>
      <td style={{ width: '30%' }}><strong>{label}</strong></td>
      <td>{value || '-'}</td>
    </tr>
  );
  const renderAddress = () => (
  <table className="table table-bordered table-sm mb-0">
    <tbody>
      {renderRow('Address', supplier.address)}
      {renderRow('Country', supplier.country)}
      {renderRow('State', supplier.state)}
      {renderRow('City', supplier.city)}
    </tbody>
  </table>
);


  const renderContact = () => (
    <table className="table table-bordered table-sm mb-0">
      <tbody>
        {renderRow('Landline', supplier.landline)}
        {renderRow('Mobile', supplier.mobile)}
        {renderRow('Fax', supplier.fax)}
        {renderRow('Email', supplier.email)}
        {renderRow('Website', supplier.website)}
        {renderRow('LinkedIn', supplier.linkedin)}
        {renderRow('Skype', supplier.skype)}
        {renderRow('Twitter', supplier.twitter)}
      </tbody>
    </table>
  );

  const renderReg = () => (
    <table className="table table-bordered table-sm mb-0">
      <tbody>
        {renderRow('Company Inc Reg Number', supplier.regNo)}
        {renderRow('Place of Registration', supplier.regPlace)}
        {renderRow('PAN', supplier.pan)}
        {renderRow('GSTIN', supplier.gstin)}
      </tbody>
    </table>
  );

  const renderBank = () => (
    <table className="table table-bordered table-sm mb-0">
      <thead>
        <tr>
          <th>S.No</th>
          <th>Bank</th>
          <th>Branch</th>
          <th>IFSC Code</th>
          <th>A/C No</th>
          <th>A/C Holder</th>
        </tr>
      </thead>
      <tbody>
        {(supplier.banks || []).map((b, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{b.bankName}</td>
            <td>{b.branchName}</td>
            <td>{b.ifsc}</td>
            <td>{b.accountNo}</td>
            <td>{b.accountHolder}</td>
          </tr>
        ))}
        {(supplier.banks || []).length === 0 && (
          <tr><td colSpan={6} className="text-center">No bank details available</td></tr>
        )}
      </tbody>
    </table>
  );

  

 const tabContent = () => {
  switch (previewTab) {
    case 'contact': return renderContact();
    case 'reg': return renderReg();
    case 'address': return renderAddress(); 
    case 'bank': return renderBank();
    case 'showAll':
    default:
      return (
        <>
          {renderContact()}
          <hr />
          {renderReg()}
          <hr />
          {renderAddress()} {/* ✅ added this to showAll too */}
          <hr />
          {renderBank()}
        </>
      );
  }
};


  return (
    <div className="card p-4">
      {/* Top Summary Section */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Supplier Preview</h4>
        <div>
          <button className="btn btn-outline-primary btn-sm mr-2" onClick={this.toggleForm}>View / Edit</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => this.setState({ showPreview: false })}>Back to List</button>
        </div>
      </div>

      <table className="table table-bordered table-sm mb-4">
        <tbody>
          {renderRow('sp Code', supplier.spCode)}
          {renderRow('Short Name', supplier.spshortName)}
          {renderRow('sp Name', supplier.spName)}
          {renderRow('Established From', supplier.establishedFrom)}
          {renderRow('Effective From', supplier.effectiveFrom)}
          {renderRow('Industry', supplier.industry)}
          {renderRow('Financial Year', supplier.financialYear)}
          {renderRow('Currency', supplier.currency)}
          {renderRow('Status', <span className={`badge ${supplier.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{supplier.status}</span>)}
        </tbody>
      </table>

      {/* Tab Switcher */}
      <ul className="nav nav-tabs mb-3">
  {[
    { key: 'showAll', label: 'Show All' },
    { key: 'contact', label: 'Contact Info' },
    { key: 'reg', label: 'Registration Details' },
    { key: 'address', label: 'Address' }, 
    { key: 'bank', label: 'Bank Details' },
  ].map(tab => (
    <li key={tab.key} className="nav-item">
      <button
        className={`nav-link ${previewTab === tab.key ? 'active' : ''}`}
        onClick={() => this.setState({ previewTab: tab.key })}
      >
        {tab.label}
      </button>
    </li>
  ))}
</ul>


      {/* Tab Content */}
      <div className="tab-content">
        {tabContent()}
      </div>
    </div>
  );
};


  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Suppliers</h4>
          
            <button className="btn btn-primary btn-sm" onClick={this.handleAddNewSupplier}>+ Add Supplier</button>
          
        </div>
        <div className="custom-table-responsive">
          <table className="table table-bordered table-sm">
            <thead className='thead-light'>
              <tr>
                <th>SP Code</th>
                <th>Short Name</th>
                <th>SP Name</th>
                <th>Establish From</th>
                <th>Effective From</th>
                <th>Industry</th>
                <th>Financial Year</th>
                <th>Currency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {this.state.supp.map((o, i) => (
                <tr key={o.id}>
                  <td><button className='btn btn-link p-0' onClick={() => this.togglePreview(o)}>{o.spCode}</button></td>
                  <td>{o.spshortName}</td>
                  <td>{o.spName}</td>
                  <td>{o.establishedFrom}</td>
                  <td>{o.effectiveFrom}</td>
                  <td>{o.industry}</td>
                  <td>{o.financialYear}</td>
                  <td>{o.currency}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
              {this.state.supp.length === 0 && <tr><td colSpan="12" className="text-center">No records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  render() {
  const { showForm, showPreview } = this.state;
  return (
    <div className="container-fluid">
      {showForm ? this.renderForm()
       : showPreview ? this.renderPreview()
       : this.renderTable()}
    </div>
  );
}

}

export default SupplierPage;