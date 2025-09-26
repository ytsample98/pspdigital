// src/app/administrator/UserCreation.js
import React, { Component } from 'react';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
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
      usercode: '', // auto assigned when creating new
      username: '',
      usermail: '',
      userresp: '', // simple text field
      userrights: '', // simple text field
      password: '',
      showPassword: false,
      // optional dashboard checkboxes (still stored in the document)
      dashboardPurchase: false,
      dashboardInventory: false,
      dashboardSales: false,
      lockUser: false,
    },
    loading: false,
  };

  componentDidMount() {
    this.fetchUsers();
  }

  // ---------- Firestore fetch ----------
  fetchUsers = async () => {
    this.setState({ loading: true });
    try {
      const snap = await getDocs(collection(db, 'users'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // sort by usercode if available
      data.sort((a, b) => (a.usercode > b.usercode ? 1 : -1));
      this.setState({ users: data, loading: false });
    } catch (err) {
      console.error('fetchUsers error', err);
      this.setState({ loading: false });
    }
  };

  // ---------- Helpers ----------
  makeNewUserCode = () => {
    // simple auto code: U + timestamp (change to any sequence generator you prefer)
    return `U${Date.now().toString().slice(-7)}`;
  };

  // open form for new user
  openCreateForm = () => {
    this.setState({
      showForm: true,
      editingId: null,
      formData: {
        usercode: this.makeNewUserCode(),
        username: '',
        usermail: '',
        userresp: '',
        userrights: '',
        password: '',
        showPassword: false,
        dashboardPurchase: false,
        dashboardInventory: false,
        dashboardSales: false,
        lockUser: false,
      },
    });
  };

  // open form for edit
  openEditForm = (user) => {
    this.setState({
      showForm: true,
      editingId: user.id,
      formData: {
        usercode: user.usercode || this.makeNewUserCode(),
        username: user.username || '',
        usermail: user.usermail || '',
        userresp: user.userresp || '',
        userrights: user.userrights || '',
        password: user.password || '',
        showPassword: false,
        dashboardPurchase: !!user.dashboardPurchase,
        dashboardInventory: !!user.dashboardInventory,
        dashboardSales: !!user.dashboardSales,
        lockUser: !!user.lockUser,
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

    const saveObj = {
      usercode: formData.usercode,
      username: formData.username,
      usermail: formData.usermail,
      userresp: formData.userresp, // free text
      userrights: formData.userrights, // free text
      password: formData.password, // NOTE: in production DO NOT store plaintext passwords
      dashboardPurchase: !!formData.dashboardPurchase,
      dashboardInventory: !!formData.dashboardInventory,
      dashboardSales: !!formData.dashboardSales,
      lockUser: !!formData.lockUser,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingId) {
        await setDoc(doc(db, 'users', editingId), saveObj, { merge: true });
      } else {
        // create
        const ref = await addDoc(collection(db, 'users'), saveObj);
        saveObj.id = ref.id;
      }
      await this.fetchUsers();
      this.setState({ showForm: false, editingId: null });
    } catch (err) {
      console.error('save user error', err);
      alert('Error saving user. Check console for details.');
    }
  };

  handleDelete = async (user) => {
    const ok = window.confirm(`Delete user ${user.username} (${user.usercode})?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'users', user.id));
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
                <input className="form-control form-control-sm" value={formData.usercode} readOnly />
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

            <div className="form-row">
              <div className="form-group col-md-6">
                <label>Responsibility</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="e.g. Sales Manager, Purchase Clerk or free text"
                  value={formData.userresp}
                  onChange={(e) => this.handleChange('userresp', e.target.value)}
                />
              </div>

              <div className="form-group col-md-6">
                <label>User Rights</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="free text or comma separated rights"
                  value={formData.userrights}
                  onChange={(e) => this.handleChange('userrights', e.target.value)}
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

              <div className="form-group col-md-8">
                <div className="mb-2">Dashboard</div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    id="dbPurchase"
                    type="checkbox"
                    checked={formData.dashboardPurchase}
                    onChange={(e) => this.handleChange('dashboardPurchase', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="dbPurchase">
                    Purchase
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    id="dbInventory"
                    type="checkbox"
                    checked={formData.dashboardInventory}
                    onChange={(e) => this.handleChange('dashboardInventory', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="dbInventory">
                    Inventory
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    id="dbSales"
                    type="checkbox"
                    checked={formData.dashboardSales}
                    onChange={(e) => this.handleChange('dashboardSales', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="dbSales">
                    Sales
                  </label>
                </div>

                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    id="lockUser"
                    type="checkbox"
                    checked={formData.lockUser}
                    onChange={(e) => this.handleChange('lockUser', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="lockUser">
                    Lock user
                  </label>
                </div>
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
                  <th>User Rights</th>
                  <th>Dashboard</th>
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
                      <td>{u.usercode}</td>
                      <td>{u.username}</td>
                      <td>{u.usermail}</td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.userresp}
                      </td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.userrights}
                      </td>
                      <td>
                        {u.dashboardPurchase ? 'P' : ''}
                        {u.dashboardInventory ? ' I' : ''}
                        {u.dashboardSales ? ' S' : ''}
                      </td>
                      <td>{u.lockUser ? 'Yes' : 'No'}</td>
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
