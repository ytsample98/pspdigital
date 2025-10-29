// src/app/administrator/Organization.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Tabs, Tab } from 'react-bootstrap';

const initialState = {
  // Organization
  short_name: '',
  business_group_name: '',
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: '',
  financial_year: '',
  status: 'Active',
  // Address
  address_line1: '',
  address_line2: '',
  address_line3: '',
  area: '',
  country: '',
  state: '',
  city: '',
  zipcode: '',
  // Contact
  landline: '',
  mobile: '',
  fax: '',
  website: '',
  email: '',
  twitter: '',
  // Registration
  company_reg_no: '',
  place_of_old_reg: '',
  tax_reg_no: '',
  currency: '',
  // Logo
  logo_url: ''
};

export default function Organization() {
  const [tab, setTab] = useState('org');
  const [form, setForm] = useState(initialState);
  const [org, setOrg] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => {
    fetchOrg();
  }, []);

  const fetchOrg = async () => {
    const res = await axios.get('/api/organization');
    if (res.data && res.data.length > 0) {
      setOrg(res.data[0]);
      setForm(res.data[0]);
    }
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleLogoChange = e => {
    const file = e.target.files[0];
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setForm(f => ({ ...f, logo_url: ev.target.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (org) {
      await axios.put(`/api/organization/${org.id}`, form);
    } else {
      await axios.post('/api/organization', form);
    }
    setEditMode(false);
    fetchOrg();
  };

  const renderTabContent = () => {
    switch (tab) {
      case 'org':
        return (
          <div className="form-row">
            <div className="form-group col-md-3">
              <label>Short Name *</label>
              <input className="form-control" name="short_name" value={form.short_name} onChange={handleChange} required disabled={!editMode} />
            </div>
            <div className="form-group col-md-4">
              <label>Business Group Name *</label>
              <input className="form-control" name="business_group_name" value={form.business_group_name} onChange={handleChange} required disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Effective From *</label>
              <input type="date" className="form-control" name="effective_from" value={form.effective_from} onChange={handleChange} required disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Effective To</label>
              <input type="date" className="form-control" name="effective_to" value={form.effective_to} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Financial Year</label>
              <input className="form-control" name="financial_year" value={form.financial_year} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Status</label>
              <select className="form-control" name="status" value={form.status} onChange={handleChange} disabled={!editMode}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
        );
      case 'address':
        return (
          <>
            <div className="form-row">
              <div className="form-group col-md-4">
                <label>Address Line 1</label>
                <input className="form-control" name="address_line1" value={form.address_line1} onChange={handleChange} disabled={!editMode} />
              </div>
              <div className="form-group col-md-4">
                <label>Address Line 2</label>
                <input className="form-control" name="address_line2" value={form.address_line2} onChange={handleChange} disabled={!editMode} />
              </div>
              <div className="form-group col-md-4">
                <label>Address Line 3</label>
                <input className="form-control" name="address_line3" value={form.address_line3} onChange={handleChange} disabled={!editMode} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-3">
                <label>Area</label>
                <input className="form-control" name="area" value={form.area} onChange={handleChange} disabled={!editMode} />
              </div>
              <div className="form-group col-md-2">
                <label>Country</label>
                <input className="form-control" name="country" value={form.country} onChange={handleChange} disabled={!editMode} />
              </div>
              <div className="form-group col-md-2">
                <label>State</label>
                <input className="form-control" name="state" value={form.state} onChange={handleChange} disabled={!editMode} />
              </div>
              <div className="form-group col-md-2">
                <label>City</label>
                <input className="form-control" name="city" value={form.city} onChange={handleChange} disabled={!editMode} />
              </div>
              <div className="form-group col-md-2">
                <label>Zipcode</label>
                <input className="form-control" name="zipcode" value={form.zipcode} onChange={handleChange} disabled={!editMode} />
              </div>
            </div>
          </>
        );
      case 'contact':
        return (
          <div className="form-row">
            <div className="form-group col-md-2">
              <label>Landline</label>
              <input className="form-control" name="landline" value={form.landline} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Mobile</label>
              <input className="form-control" name="mobile" value={form.mobile} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Fax</label>
              <input className="form-control" name="fax" value={form.fax} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Website</label>
              <input className="form-control" name="website" value={form.website} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Email</label>
              <input className="form-control" name="email" value={form.email} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-2">
              <label>Twitter</label>
              <input className="form-control" name="twitter" value={form.twitter} onChange={handleChange} disabled={!editMode} />
            </div>
          </div>
        );
      case 'registration':
        return (
          <div className="form-row">
            <div className="form-group col-md-3">
              <label>Company Reg No</label>
              <input className="form-control" name="company_reg_no" value={form.company_reg_no} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-3">
              <label>Place of Old Reg</label>
              <input className="form-control" name="place_of_old_reg" value={form.place_of_old_reg} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-3">
              <label>Tax Reg No</label>
              <input className="form-control" name="tax_reg_no" value={form.tax_reg_no} onChange={handleChange} disabled={!editMode} />
            </div>
            <div className="form-group col-md-3">
              <label>Currency</label>
              <input className="form-control" name="currency" value={form.currency} onChange={handleChange} disabled={!editMode} />
            </div>
          </div>
        );
      case 'logo':
        return (
          <div className="form-group">
            <label>Logo</label>
            <input type="file" className="form-control-file" onChange={handleLogoChange} disabled={!editMode} />
            {form.logo_url && <img src={form.logo_url} alt="Logo" style={{ maxHeight: 100, marginTop: 10 }} />}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container-fluid">
      <div className="card p-4">
        <h4>Organization</h4>
        <Tabs activeKey={tab} onSelect={setTab} className="mb-3">
          <Tab eventKey="org" title="Organization" />
          <Tab eventKey="address" title="Address" />
          <Tab eventKey="contact" title="Contact" />
          <Tab eventKey="registration" title="Registration" />
          <Tab eventKey="logo" title="Logo" />
        </Tabs>
        <form onSubmit={handleSubmit}>
          {renderTabContent()}
          <div className="mt-3">
            {!org && !editMode && (
              <button className="btn btn-success" type="button" onClick={() => setEditMode(true)}>
                Add Organization
              </button>
            )}
            {editMode && (
              <>
                <button className="btn btn-primary mr-2" type="submit">
                  {org ? 'Update' : 'Create'}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => { setEditMode(false); setForm(org || initialState); }}>
                  Cancel
                </button>
              </>
            )}
            {org && !editMode && (
              <button className="btn btn-warning" type="button" onClick={() => setEditMode(true)}>
                Edit
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}