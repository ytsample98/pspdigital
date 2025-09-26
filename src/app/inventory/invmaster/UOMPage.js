// UOMForm.js (React 16 + Bootstrap compatible with your sidebar and route setup)
import React, { Component } from 'react';
import { db } from '../../../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import '../../../assets/styles/components/_custom-table.scss';

class UOMPage extends Component {
  state = {
    uoms: [],
    showForm: false,
    editingIndex: null,
    formData: { name: '', description: '' },
  };

  componentDidMount() {
    this.fetchUOMs();
  }

  fetchUOMs = async () => {
    const snap = await getDocs(collection(db, 'uoms'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ uoms: data });
  };

  toggleForm = (index = null) => {
    if (index !== null) {
      this.setState({
        showForm: true,
        editingIndex: index,
        formData: { ...this.state.uoms[index] },
      });
    } else {
      this.setState({
        showForm: true,
        editingIndex: null,
        formData: { name: '', description: '' },
      });
    }
  };

  handleChange = (field, value) => {
    this.setState(prev => ({ formData: { ...prev.formData, [field]: value } }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingIndex, formData, uoms } = this.state;
    if (!formData.name) return alert('UOM Name is required.');

    if (editingIndex !== null) {
      const docId = uoms[editingIndex].id;
      await deleteDoc(doc(db, 'uoms', docId));
    }

    await addDoc(collection(db, 'uoms'), formData);
    this.setState({ showForm: false, editingIndex: null });
    this.fetchUOMs();
  };

  handleDelete = async (index) => {
    const id = this.state.uoms[index].id;
    await deleteDoc(doc(db, 'uoms', id));
    this.fetchUOMs();
  };

  renderForm = () => {
    const { formData } = this.state;
    return (
      <form className="card full-height" onSubmit={this.handleSubmit}>
         <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">{this.state.editingIndex !== null ? 'Edit UOM' : 'New UOM'}</h4>
        <div className="form-row">
       <div className="form-group col-sm-3">
          <label>UOM Name *</label>
          <input
            className="form-control"
            value={formData.name}
            onChange={e => this.handleChange('name', e.target.value)}
            required
          />
          </div>
        <div className="form-group col-md-6">
          <label>Description</label>
          <input
            className="form-control"
            value={formData.description}
            onChange={e => this.handleChange('description', e.target.value)}
          />
        </div>
        </div>
        <div className="fixed-card-footer">
        <button type="submit" className="btn btn-success">Save</button>
        <button type="button" className="btn btn-secondary" onClick={() => this.setState({ showForm: false })}>Cancel</button>
        </div>
        </div>
      </form>
    );
  };

  renderTable = () => (
    
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">UOM Master</h4>
          <button className="btn btn-primary" onClick={() => this.toggleForm()}>+ Add UOM</button>
        </div>
        <div className="custom-table-responsive">
          <table className="table table-bordered ">
            <thead className="thead-light">
              <tr>
                <th>UOM</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {this.state.uoms.map((u, i) => (
                <tr key={u.id} style={{height:'50px',verticalAlign:'middle'}}>
                  <td><button className='btn btn-link p-0' onClick={() => this.toggleForm(i)}>{u.name}</button></td>
                  <td>{u.description}</td>
                </tr>
              ))}
              {this.state.uoms.length === 0 && (
                <tr><td colSpan="3" className="text-center">No UOMs added yet.</td></tr>
              )}
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

export default UOMPage;
