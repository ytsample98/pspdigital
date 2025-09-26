import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';

class CustomerForm extends Component {
  state = {
    formType: 'customer',
    formData: {
      company: '', gst: '', cin: '', name: '', phone: '', email: '', website: '',
      billing: { line1: '', line2: '', pincode: '', city: '', state: '' },
      shipping: { line1: '', line2: '', pincode: '', city: '', state: '', sameAsBilling: false }
    },
    editingId: null,
    customers: [],
    orgs: [],
    vendors: []
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    const collections = ['customers', 'orgs', 'vendors'];
    for (const type of collections) {
      const snapshot = await getDocs(collection(db, type));
      const data = snapshot.docs.map((doc, i) => ({ id: doc.id, index: i + 1, ...doc.data() }));
      this.setState({ [type]: data });
    }
  };

  handleChange = (field, value) => {
    const keys = field.split('.');
    this.setState(prev => {
      const newFormData = { ...prev.formData };
      if (keys.length === 1) newFormData[keys[0]] = value;
      else newFormData[keys[0]][keys[1]] = value;
      return { formData: newFormData };
    });
  };

  handleSameAsBilling = () => {
    this.setState(prev => {
      const { billing, shipping } = prev.formData;
      const updatedShipping = shipping.sameAsBilling
        ? { line1: '', line2: '', pincode: '', city: '', state: '', sameAsBilling: false }
        : { ...billing, sameAsBilling: true };
      return {
        formData: { ...prev.formData, shipping: updatedShipping }
      };
    });
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const collectionName = this.state.formType === 'customer' ? 'customers' : this.state.formType === 'organisation' ? 'orgs' : 'vendors';
    try {
      if (this.state.editingId) {
        await updateDoc(doc(db, collectionName, this.state.editingId), this.state.formData);
      } else {
        await addDoc(collection(db, collectionName), this.state.formData);
      }
      this.setState({ editingId: null });
      this.fetchData();
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  handleEdit = (type, entry) => {
    this.setState({
      formType: type,
      formData: { ...entry },
      editingId: entry.id
    });
  };

  renderInput(label, field, type = 'text', required = false, disabled = false) {
    const value = field.includes('.')
      ? this.state.formData[field.split('.')[0]][field.split('.')[1]]
      : this.state.formData[field];
    return (
      <Form.Group className="form-group mb-1">
        <label>{label}</label>
        <Form.Control
          type={type}
          className="form-control"
          value={value}
          placeholder={`${label}${required ? '*' : ''}`}
          onChange={(e) => this.handleChange(field, e.target.value)}
          disabled={disabled}
        />
      </Form.Group>
    );
  }

  renderTable = (data, type) => (
    <div className="card mt-4">
      <div className="card-body">
        <h4 className="card-title">{type.charAt(0).toUpperCase() + type.slice(1)} List</h4>
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>ID</th>
                <th>Company</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={item.id}>
                  <td>{type[0]}{index + 1}</td>
                  <td>{item.company}</td>
                  <td>{item.name}</td>
                  <td>{item.phone}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => this.handleEdit(type === 'customers' ? 'customer' : type === 'orgs' ? 'organisation' : 'vendor', item)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  render() {
    const { sameAsBilling } = this.state.formData.shipping;
    return (
      <div className="card">
        <div className="card-body">
          <h4 className="card-title">Party Form</h4>
          <form className="form-sample" onSubmit={this.handleSubmit}>
          <div className="form-row">
            <div className="form-group row ">
            <label className="col-md-3 col-form-label">Entity Type</label>
            <div className="col-md-8 d-flex">
                {['customer', 'organisation', 'vendor'].map(type => (
                  <div key={type} className="form-check form-check-inline mr-3 mb-0" style={{ display: 'flex', alignItems: 'center', alignContent:'flex-end' }}>
                    <input
                      className="form-check-input"
                      type="radio"
                      name="entityType"
                      value={type}
                      checked={this.state.formType === type}
                      onChange={() => this.setState({ formType: type })}
                      id={`entityType-${type}`}
                    />
                    <label className="form-check-label text-capitalize ml-2" htmlFor={`entityType-${type}`} style={{ marginBottom: 0 }}>{type}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

            <p className="card-description mt-3 mb-1">Organisation Details</p>
            <div className="form-row">
              <div className="form-group col-md-4">{this.renderInput('Company Name', 'company', 'text', true)}</div>
              <div className="form-group col-md-4">{this.renderInput('GST IN', 'gst', 'text', true)}</div>
              <div className="form-group col-md-4">{this.renderInput('CIN', 'cin', 'text', true)}</div>
            </div>

            <p className="card-description mt-3 mb-1">Contact Details</p>
            <div className="form-row">
              <div className="form-group col-md-4">{this.renderInput('Name', 'name', 'text', true)}</div>
              <div className="form-group col-md-4">{this.renderInput('Phone Number', 'phone', 'text', true)}</div>
              <div className="form-group col-md-4">{this.renderInput('Email', 'email', 'email', true)}</div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-6">{this.renderInput('Website', 'website', 'url')}</div>
            </div>

            <p className="card-description mt-3 mb-1">Billing Address</p>
            <div className="form-row">
              <div className="form-group col-md-6">{this.renderInput('Address Line 1', 'billing.line1', 'text', true)}</div>
              <div className="form-group col-md-6">{this.renderInput('Address Line 2', 'billing.line2')}</div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-4">{this.renderInput('State', 'billing.state', 'text', true)}</div>
              <div className="form-group col-md-4">{this.renderInput('City', 'billing.city', 'text', true)}</div>
              <div className="form-group col-md-4">{this.renderInput('Pin', 'billing.pincode', 'text', true)}</div>
            </div>

            <p className="card-description mt-3 mb-1">Shipping Address</p>
            <div className="form-row align-items-center">
              <div className="form-group col-md-4 mb-2">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={this.handleSameAsBilling}
                    id="sameAsBilling"
                  />
                  <label className="form-check-label" htmlFor="sameAsBilling">Same as Billing</label>
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-6">{this.renderInput('Address Line 1', 'shipping.line1', 'text', false, sameAsBilling)}</div>
              <div className="form-group col-md-6">{this.renderInput('Address Line 2', 'shipping.line2', 'text', false, sameAsBilling)}</div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-4">{this.renderInput('State', 'shipping.state', 'text', false, sameAsBilling)}</div>
              <div className="form-group col-md-4">{this.renderInput('City', 'shipping.city', 'text', false, sameAsBilling)}</div>
              <div className="form-group col-md-4">{this.renderInput('Pincode', 'shipping.pincode', 'text', false, sameAsBilling)}</div>
            </div>

            <div className="text-right mt-4">
              <button type="submit" className="btn btn-success">Save</button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default CustomerForm;