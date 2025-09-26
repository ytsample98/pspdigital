import React, { Component } from 'react';
import { db } from '../../../firebase';import { Dropdown } from 'react-bootstrap';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import '../../../assets/styles/components/_custom-table.scss';
class TaxComponent extends Component {
  state = {
    taxcomp: [],
    showForm: false,
    editingIndex: null,
    formData: { code: '', name: '' },
  };

  componentDidMount() {
    this.fetchtaxcomp();
  }

  fetchtaxcomp = async () => {
    const snap = await getDocs(collection(db, 'taxcomp'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ taxcomp: data });
  };

  toggleForm = (index = null) => {
    if (index !== null) {
      this.setState({
        showForm: true,
        editingIndex: index,
        formData: { ...this.state.taxcomp[index] },
      });
    } else {
      this.setState({
        showForm: true,
        editingIndex: null,
        formData: { code: '', name: '' },
      });
    }
  };

  handleChange = (field, value) => {
    this.setState(prev => ({ formData: { ...prev.formData, [field]: value } }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingIndex, formData, taxcomp } = this.state;
    if (!formData.name) return alert('Tax Component codes is required.');

    if (editingIndex !== null) {
      const docId = taxcomp[editingIndex].id;
      await deleteDoc(doc(db, 'taxcomp', docId));
    }

    await addDoc(collection(db, 'taxcomp'), formData);
    this.setState({ showForm: false, editingIndex: null });
    this.fetchtaxcomp();
  };

  handleDelete = async (index) => {
    const id = this.state.taxcomp[index].id;
    await deleteDoc(doc(db, 'taxcomp', id));
    this.fetchtaxcomp();
  };

  renderForm = () => {
    const { formData } = this.state;
    return (
      <form className="card full-height" onSubmit={this.handleSubmit}>
         <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">{this.state.editingIndex !== null ? 'Edit Mode' : 'New Mode'}</h4>
        <div className="form-row">
       <div className="form-group col-sm-3">
          <label>Tax Component codes*</label>
          <input
            className="form-control"
            value={formData.code}
            onChange={e => this.handleChange('code', e.target.value)}
            required
          />
          </div>
        <div className="form-group col-md-6">
          <label>Name</label>
          <input
            className="form-control"
            value={formData.name}
            onChange={e => this.handleChange('name', e.target.value)}
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
          <h4 className="card-title">Tax Components</h4>
          <button className="btn btn-primary" onClick={() => this.toggleForm()}>+ Add Component</button>
        </div>
        <div className="custom-table-responsive">
          <table className="table table-bordered ">
            <thead className="thead-light">
              <tr>
                <th>Component Code</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {this.state.taxcomp.map((d, i) => (
                <tr key={d.id} style={{height:'50px',verticalAlign:'middle'}}>
                  <td><button className='btn btn-link p-0' onClick={() => this.toggleForm(i)}>{d.code}</button></td>
                  <td>{d.name}</td>
                </tr>
              ))}
              {this.state.taxcomp.length === 0 && (
                <tr><td colSpan="3" className="text-center">No taxcomp added yet.</td></tr>
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

export default TaxComponent;
