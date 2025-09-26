import React, { Component } from 'react';
import { db } from '../../../firebase';import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import '../../../assets/styles/components/_custom-table.scss';

const TYPE_OPTIONS = ['Immediate', 'Days', 'Month'];

class PaymentTerms extends Component {
  state = {
    terms: [],
    showForm: false,
    editingId: null,
    formData: { name: '', type: 'Immediate', description: '' }
  };

  componentDidMount() {
    this.fetchTerms();
  }

  fetchTerms = async () => {
    const snap = await getDocs(collection(db, 'paymentTerms'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ terms: data });
  };

  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({ showForm: true, editingId: edit.id, formData: { ...edit } });
    } else {
      this.setState({ showForm: true, editingId: null, formData: { name: '', type: 'Immediate', description: '' } });
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
    if (!formData.name) return alert('Enter name');
    if (editingId) {
      await setDoc(doc(db, 'paymentTerms', editingId), formData);
    } else {
      await addDoc(collection(db, 'paymentTerms'), formData);
    }
    this.setState({ showForm: false, editingId: null });
    this.fetchTerms();
  };

  handleDelete = async (id) => {
    await deleteDoc(doc(db, 'paymentTerms', id));
    this.fetchTerms();
  };

  renderForm = () => {
    const { formData } = this.state;
    return (
      <div className="card full-height">
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">Payment Terms</h4>
        <form className="form-sample" onSubmit={this.handleSubmit} autoComplete="off">
          <div className="form-row">
            <div className="form-group col-md-4">
              <label>Name</label>
              <input className="form-control form-control-sm" value={formData.name} onChange={e => this.handleChange('name', e.target.value)} required />
            </div>
            <div className="form-group col-md-4">
              <label>Type</label>
              <select className="form-control form-control-sm" value={formData.type} onChange={e => this.handleChange('type', e.target.value)}>
                {TYPE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="form-group col-md-4">
              <label>Description</label>
              <input className="form-control form-control-sm" value={formData.description} onChange={e => this.handleChange('description', e.target.value)} />
            </div>
          </div>
          <div className="fixed-card-footer">
            <button type="submit" className="btn btn-success btn-sm">Save</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ showForm: false })}>Cancel</button>
          </div>
        </form>
      </div>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Payment Terms</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>+ Add Payment Term</button>
        </div>
        <div className="custom-table-responsive">
        <table className="table table-bordered table-sm">
          <thead className='thead-light'>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {this.state.terms.map((t, i) => (
              <tr key={t.id}>
                <td><button className='btn btn-link p-0' onClick={() => this.toggleForm(t)}>{t.name}</button></td>
                <td>{t.type}</td>
                <td>{t.description}</td>
              </tr>
            ))}
            {this.state.terms.length === 0 && <tr><td colSpan="4" className="text-center">No records found</td></tr>}
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

export default PaymentTerms;