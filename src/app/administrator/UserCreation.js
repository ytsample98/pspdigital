// src/app/administrator/UserCreation.js
import React, { Component } from 'react';
import axios from 'axios';
import '../../assets/styles/components/_custom-table.scss';

/*
  UserCreation component
  - Simple create/edit/delete user UI (form + table)
  - Responsibilities and rights are plain text fields (per request)
  - Stores users in Firestore collection: "users"
  - Behavior:
    - Shows table of users by default
    - "+ Create User" opens the form (replaces table view)
    - Edit loads data into the form
    - Save creates/updates document in Firestore
    - Delete removes document from Firestore after confirmation
*/

class UserCreation extends Component {
  state = {
    users: [],
    showForm: false,
    editingId: null,
    // form data: responsibilities & rights are simple text fields (CSV or description)
    formData: {
      empcode: '', 
      username: '',
      usermail: '',
      userresp: '', // will store responsibility id
      userrights: '', // simple text field
      password: '',
      confirmPassword: '',
      showPassword: false,
      lockUser: false,
      user_type_id: ''
    },
    loading: false,
    types: [],
    responsibilities: []
  };

  componentDidMount() {
    this.fetchUsers();
    this.fetchMasters();
    this.fetchLookups();
  }

  fetchLookups = async () => {
    try {
      const [dRes, pRes] = await Promise.all([axios.get('/api/department'), axios.get('/api/plant')]);
      this.setState({ departments: dRes.data || [], plants: pRes.data || [] });
    } catch (err) { console.error('fetchLookups', err); }
  };

  // ---------- Firestore fetch ----------
  fetchUsers = async () => {
    this.setState({ loading: true });
    try {
      const res = await axios.get('/api/users');
      const data = res.data || [];
      data.sort((a, b) => (a.emp_code > b.emp_code ? 1 : -1));
      this.setState({ users: data, loading: false });
    } catch (err) {
      console.error('fetchUsers error', err);
      this.setState({ loading: false });
    }
  };

  fetchMasters = async () => {
    try {
      const [tRes, rRes] = await Promise.all([axios.get('/api/user_type'), axios.get('/api/user_responsibility')]);
      this.setState({ types: tRes.data || [], responsibilities: rRes.data || [] });
    } catch (err) { console.error('fetchMasters', err); }
  };

  // ---------- Helpers ----------
  makeNewempcode = () => {
    // simple auto code: U + timestamp (change to any sequence generator you prefer)
    return `U${Date.now().toString().slice(-7)}`;
  };

  // open form for new user
  openCreateForm = () => {
    this.setState({
      showForm: true,
      editingId: null,
      formData: {
        empcode: this.makeNewempcode(),
        username: '',
        usermail: '',
        userresp: '',
        userrights: '',
        password: '',
        confirmPassword: '',
        showPassword: false,
        lockUser: false,
        user_type_id: ''
      },
    });
  };

  // open form for edit
  openEditForm = (user) => {
    this.setState({
      showForm: true,
      editingId: user.id,
      formData: {
        empcode: user.emp_code || this.makeNewempcode(),
        username: user.username || '',
        usermail: user.email || '',
        userresp: user.user_resp_id || '',
        userrights: user.user_rights || '',
        password: '',
        confirmPassword: '',
        showPassword: false,
        lockUser: !!user.lock_user,
        user_type_id: user.user_type_id || ''
      },
    });
  };

  // cancel form
  cancelForm = () => {
    this.setState({ showForm: false, editingId: null });
  };

  handleChange = (field, value) => {
    this.setState((prev) => ({
      formData: { ...prev.formData, [field]: value },
    }));
  };

  // submit (create or update)
  handleSubmit = async (e) => {
    e && e.preventDefault();
    const { editingId, formData } = this.state;

    // basic validation
    if (!formData.username || !formData.usermail) {
      alert('Please provide Username and E-Mail.');
      return;
    }

    if (!editingId && (!formData.password || formData.password !== formData.confirmPassword)) {
      alert('Passwords do not match or empty');
      return;
    }

    // map to backend column names
    const payload = {
      empcode: formData.empcode,
      username: formData.username,
      usermail: formData.usermail,
      password: formData.password,
      user_resp_id: formData.userresp,
      dept_id: formData.dept_id || formData.deptId || null,
      plant_id: formData.plant_id || formData.plantId || null,
      lock_user: !!formData.lockUser,
      user_type_id: formData.user_type_id
    };

    try {
      if (editingId) {
        await axios.put(`/api/users/${editingId}`, payload);
      } else {
        await axios.post('/api/users', payload);
      }
      await this.fetchUsers();
      this.setState({ showForm: false, editingId: null });
    } catch (err) {
      console.error('save user error', err && err.response || err.message || err);
      alert('Error saving user. Check console for details.');
    }
  };

  handleDelete = async (user) => {
    const ok = window.confirm(`Delete user ${user.username} (${user.empcode})?`);
    if (!ok) return;
    try {
      await axios.delete(`/api/users/${user.id}`);
      await this.fetchUsers();
    } catch (err) {
      console.error('delete user error', err);
      alert('Error deleting user. Check console for details.');
    }
  };

  renderForm = () => {
    const { formData } = this.state;
    return (
      <div className="card full-height">
        <div style={{ padding: 20 }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>User Creation</h4>
            <div>
              <button className="btn btn-secondary btn-sm mr-2" onClick={this.cancelForm}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={this.handleSubmit}>
                {this.state.editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>

          <form onSubmit={this.handleSubmit} autoComplete="off">
            <div className="form-row">
              <div className="form-group col-md-2">
                <label>User Code</label>
                <input className="form-control form-control-sm" value={formData.empcode} readOnly />
              </div>

              <div className="form-group col-md-4">
                <label>User Name *</label>
                <input
                  className="form-control form-control-sm"
                  value={formData.username}
                  onChange={(e) => this.handleChange('username', e.target.value)}
                  required
                />
              </div>

              <div className="form-group col-md-6">
                <label>E-Mail *</label>
                <input
                  type="email"
                  className="form-control form-control-sm"
                  value={formData.usermail}
                  onChange={(e) => this.handleChange('usermail', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row align-items-end">
              <div className="form-group col-md-4">
                <label>Password</label>
                <input
                  type={formData.showPassword ? 'text' : 'password'}
                  className="form-control form-control-sm"
                  value={formData.password}
                  onChange={(e) => this.handleChange('password', e.target.value)}
                />
                <label style={{marginTop:8}}>Confirm Password</label>
                <input type={formData.showPassword ? 'text' : 'password'} className="form-control form-control-sm" value={formData.confirmPassword} onChange={e=>this.handleChange('confirmPassword', e.target.value)} />
                <div className="form-check mt-1">
                  <input
                    className="form-check-input"
                    id="showPwd"
                    type="checkbox"
                    checked={formData.showPassword}
                    onChange={(e) => this.handleChange('showPassword', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="showPwd">
                    Show Password
                  </label>
                </div>
              </div>
              <div className="form-check mt-2">
                  <label style={{display:'block'}}>Status</label>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" role="switch" id="lockUser" checked={!formData.lockUser} onChange={(e) => this.handleChange('lockUser', !e.target.checked)} />
                    <label className="form-check-label" htmlFor="lockUser">Active</label>
                  </div>
                </div>
            </div>

            <div className="form-row">
              <div className="form-group col-md-4">
                <label>User Type</label>
                <select className="form-control form-control-sm" value={formData.user_type_id} onChange={e=>this.handleChange('user_type_id', e.target.value)}>
                  <option value="">Select Type</option>
                  {this.state.types.map(t => <option key={t.id} value={t.id}>{t.type_name}</option>)}
                </select>
              </div>
              <div className="form-group col-md-4">
                <label>Department</label>
                <select className="form-control form-control-sm" value={formData.dept_id || ''} onChange={e=>this.handleChange('dept_id', e.target.value)}>
                  <option value="">Select Dept</option>
                  {(this.state.departments||[]).map(d => <option key={d.id} value={d.id}>{d.dept_name || d.deptName || d.dept_name}</option>)}
                </select>
              </div>

              <div className="form-group col-md-4">
                <label>Plant</label>
                <select className="form-control form-control-sm" value={formData.plant_id || ''} onChange={e=>this.handleChange('plant_id', e.target.value)}>
                  <option value="">Select Plant</option>
                  {(this.state.plants||[]).map(p => <option key={p.id} value={p.id}>{p.plant_name || p.plantName}</option>)}
                </select>
              </div>

              <div className="form-group col-md-4">
                <label>User Responsibility</label>
                <select className="form-control form-control-sm" value={formData.userresp} onChange={e=>this.handleChange('userresp', e.target.value)}>
                  <option value="">Select Responsibility</option>
                  {this.state.responsibilities.map(r => <option key={r.id} value={r.id}>{r.resp_name}</option>)}
                </select>
              </div>
            </div>

            {/* fixed footer like in your screenshot */}
            <div style={{ marginTop: 18, borderTop: '1px solid #e9ecef', paddingTop: 12 }}>
              <button type="button" className="btn btn-secondary btn-sm mr-2" onClick={this.cancelForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success btn-sm">
                {this.state.editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  renderTable = () => {
    const { users, loading } = this.state;
    return (
      <div className="card mt-3 full-height">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="card-title">Users</h4>
            <div>
              <button className="btn btn-primary btn-sm" onClick={this.openCreateForm}>
                + Create User
              </button>
            </div>
          </div>

          <div className="custom-table-responsive">
            <table className="table table-bordered table-sm">
              <thead className="thead-light">
                <tr>
                  <th>User Code</th>
                  <th>User Name</th>
                  <th>E-Mail</th>
                  <th>Responsibility</th>
                  <th>User Type</th>
                  <th>Lock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="8" className="text-center">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading &&
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.empcode || u.emp_code}</td>
                      <td>{u.username}</td>
                      <td>{u.usermail || u.email}</td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.resp_name}
                      </td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.user_type || u.type_name}
                      </td>
                      <td>{u.lock_user ? 'Inactive' : 'Active'}</td>
                      <td>
                        <button className="btn btn-sm btn-link p-0 mr-2" onClick={() => this.openEditForm(u)}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-link text-danger p-0" onClick={() => this.handleDelete(u)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  render() {
    const { showForm } = this.state;
    return <div className="container-fluid">{showForm ? this.renderForm() : this.renderTable()}</div>;
  }
}

export default UserCreation;
