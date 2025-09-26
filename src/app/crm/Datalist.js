import React, { Component } from "react";
import { db } from "../../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { Country, State, City } from "country-state-city";
import { Dropdown } from "react-bootstrap";
import * as XLSX from "xlsx";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";



let accountCounter = 100;
function generateAccountNo() {
  accountCounter++;
  return `AC${accountCounter}`;
}

class Datalist extends Component {
  state = {
    accounts: [],
    industryType:[],
    industrySearch:"",
    industryDropdownSize:8,
    showForm: false,
    showPreview: false,
    editingId: null,
    previewTab: "showAll",
    search: "",
    comments: [],
    remarks:[],
    contactLine: {
      name: "",
      designation: "",
      phone: "",
      mail: "",
      linkedin: ""
    },
    formData: {
      acno: "",
      acname: "",
      acshortname:"",
      industryType:"",
      contact: "",
      email: "",
      website: "",
      phone: "",
      comlinkedin: "",
      country: "",
      state: "",
      city: "",
      contactPersons: [],
      editIndex: null
    }
  };

  componentDidMount() {
    this.fetchAccounts();
    this.loadIndustryTypes();
  }
  loadIndustryTypes=async()=>{
    try {
      const response = await fetch("/industry_types.xlsx");
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Flatten and filter empty rows
      const types = data.flat().filter((t) => t && typeof t === "string");
      this.setState({ industryTypes: types });
    } catch (err) {
      // fallback: hardcoded example
      this.setState({
        industryTypes: [
          "Automotive", "Banking", "Construction", "Education", "Energy", "Healthcare", "IT", "Manufacturing",
          "Pharmaceutical", "Retail", "Telecom", "Transport", "Utilities"
        ]
      });
    }
  }

  fetchAccounts = async () => {
    const snap = await getDocs(collection(db, "accounts"));
    const accounts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ accounts });
  };
  fetchRemarksForAccount = async (acname) => {
  const snap = await getDocs(collection(db, "activities"));
  const allActs = snap.docs.map((d) => d.data());
  const related = allActs
    .filter((a) => a.acname === acname)
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // newest first
  this.setState({ remarks: related });
};


  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({
        showForm: true,
        editingId: edit.id,
        formData: { ...edit, editIndex: null },
        showPreview: false
      });
    } else {
      this.setState({
        showForm: true,
        editingId: null,
        showPreview: false,
        formData: {
          acno: generateAccountNo(),
          acname: "",
          acshortname:"",
          contact: "",
          email: "",
          website: "",
          phone: "",
          comlinkedin:"",
          country: "",
          state: "",
          city: "",
          contactPersons: [],
          editIndex: null
        }
      });
    }
  };

  togglePreview = (acc) => {
    this.setState({
      formData: { ...acc },
      showPreview: true,
      showForm: false
    });
    this.fetchRemarksForAccount(acc.acname);
  };

  handleChange = (field, value) => {
    this.setState((prev) => ({ formData: { ...prev.formData, [field]: value } }));
  };

  handleContactLineChange = (field, value) => {
    this.setState((prev) => ({ contactLine: { ...prev.contactLine, [field]: value } }));
  };

  addOrUpdateContact = () => {
    const { contactLine, formData } = this.state;
    if (!contactLine.name) return alert("Name required");
    const isAllEmpty = Object.values(contactLine).every(val => !val.trim());
    if (isAllEmpty) return;

    let list = [...formData.contactPersons];
    if (formData.editIndex !== null) {
      list[formData.editIndex] = contactLine;
    } else {
      list.push(contactLine);
    }
    this.setState({
      formData: { ...formData, contactPersons: list, editIndex: null },
      contactLine: { name: "", designation: "", phone: "", mail: "", linkedin: "" }
    });
  };

  editContact = (idx) => {
    const cp = this.state.formData.contactPersons[idx];
    this.setState({ contactLine: { ...cp }, formData: { ...this.state.formData, editIndex: idx } });
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData } = this.state;
    if (!formData.acname) return alert("Account Name required");
    if (editingId) {
      await updateDoc(doc(db, "accounts", editingId), formData);
    } else {
      await addDoc(collection(db, "accounts"), formData);
    }
    this.setState({ showForm: false, editingId: null });
    this.fetchAccounts();
  };

  handleDelete = async (id) => {
    await deleteDoc(doc(db, "accounts", id));
    this.fetchAccounts();
  };

  renderForm = () => {
    const { formData, contactLine, industryTypes, industrySearch, industryDropdownSize } = this.state;
    const countryOptions = Country.getAllCountries();
    const stateOptions = formData.country ? State.getStatesOfCountry(formData.country) : [];
    const cityOptions = formData.state ? City.getCitiesOfState(formData.country, formData.state) : [];
    const filteredIndustryTypes = industryTypes.filter((t) =>
      t.toLowerCase().includes((industrySearch || "").toLowerCase())
    );
    const visibleIndustryTypes = filteredIndustryTypes.slice(0, industryDropdownSize);
    return (
      <div className="card full-height">
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <h4>Account Creation/Update</h4>
          <form onSubmit={this.handleSubmit}>
            <div className="form-row">
              <div className="form-group col-md-2">
                <label>Account No</label>
                <input className="form-control form-control-sm" value={formData.acno} readOnly />
              </div>
              <div className="form-group col-md-2">
                <label>
                  Short Name <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  className="form-control form-control-sm"
                  value={formData.acshortname}
                  type="text"
                  onChange={(e) => this.handleChange("acshortname", e.target.value)}
                  required
                />
              </div>
              <div className="form-group col-md-3">
                <label>
                  Account Name <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  className="form-control form-control-sm"
                  value={formData.acname}
                  type="text"
                  onChange={(e) => this.handleChange("acname", e.target.value)}
                  required
                />
              </div>
              <div className="form-group col-md-2">
              <label>Industry Type <span style={{ color: "red" }}>*</span></label>
              <Typeahead
                id="industry-type"
                options={filteredIndustryTypes}  
                placeholder="Search or select industry..."
                selected={formData.industryType ? [formData.industryType] : []}
                onChange={(selected) => {
                  this.handleChange("industryType", selected[0] || "");
                }}
                required
              />
            </div>
            <div className="form-group col-md-3">
                <label>Contact <span style={{ color: "red" }}>*</span></label>
                <input className="form-control form-control-sm" type="text" value={formData.contact} onChange={(e) => this.handleChange("contact", e.target.value)} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group col-md-3">
                <label>Email</label>
                <input className="form-control form-control-sm" type="email" value={formData.email} onChange={(e) => this.handleChange("email", e.target.value)} />
              </div>
              <div className="form-group col-md-3">
                <label>
                  Phone <span style={{ color: "red" }}>*</span>
                </label>
                <input className="form-control form-control-sm" type="number" value={formData.phone} onChange={(e) => this.handleChange("phone", e.target.value)} />
              </div>
              <div className="form-group col-md-3">
                <label>
                  Website <span style={{ color: "red" }}>*</span>
                </label>
                <input className="form-control form-control-sm" type="website" value={formData.website} onChange={(e) => this.handleChange("website", e.target.value)} />
              </div>
              <div className="form-group col-md-3">
                <label>
                  LinkedIn <span style={{ color: "red" }}>*</span>
                </label>
                <input className="form-control form-control-sm" type="website" value={formData.comlinkedin} onChange={(e) => this.handleChange("comlinkedin", e.target.value)} />
              </div>
              

            </div>
             <div className="form-row">
              <div className="form-group col-md-3">
                <label>Country <span style={{ color: "red" }}>*</span></label>
                <select
                  className="form-control form-control-sm"
                  value={formData.country}
                  onChange={(e) => this.handleChange("country", e.target.value)}
                  required
                >
                  <option value="">Select Country</option>
                  {countryOptions.map((c) => (
                    <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group col-md-3">
                <label>State</label>
                <select
                  className="form-control form-control-sm"
                  value={formData.state}
                  onChange={(e) => this.handleChange("state", e.target.value)}
                  disabled={!formData.country}
                >
                  <option value="">Select State</option>
                  {stateOptions.map((s) => (
                    <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group col-md-3">
                <label>City</label>
                <select
                  className="form-control form-control-sm"
                  value={formData.city}
                  onChange={(e) => this.handleChange("city", e.target.value)}
                  disabled={!formData.state}
                >
                  <option value="">Select City</option>
                  {cityOptions.map((ct) => (
                    <option key={ct.name} value={ct.name}>{ct.name}</option>
                  ))}
                </select>
                 </div>
              {/* Industry Type Dropdown */}
             
              </div>

            {/* Contact Line Item Table */}
            <h5>Contact Persons</h5>
            <div className="form-row">
              <input className="form-control col-md-2 mr-2" placeholder="Name" value={contactLine.name} onChange={(e) => this.handleContactLineChange("name", e.target.value)} />
              <input className="form-control col-md-2 mr-2" placeholder="Designation" value={contactLine.designation} onChange={(e) => this.handleContactLineChange("designation", e.target.value)} />
              <input className="form-control col-md-2 mr-2" placeholder="Phone" value={contactLine.phone} onChange={(e) => this.handleContactLineChange("phone", e.target.value)} />
              <input className="form-control col-md-2 mr-2" placeholder="Mail" value={contactLine.mail} onChange={(e) => this.handleContactLineChange("mail", e.target.value)} />
              <input className="form-control col-md-2 mr-2" placeholder="LinkedIn" value={contactLine.linkedin} onChange={(e) => this.handleContactLineChange("linkedin", e.target.value)} />
              <button type="button" className="btn btn-primary btn-sm" onClick={this.addOrUpdateContact}>
                {formData.editIndex !== null ? "Update" : "Add"}
              </button>
            </div>

            <table className="table table-bordered table-sm mt-2">
              <thead>
                <tr>
                  <th>Edit</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Phone</th>
                  <th>Mail</th>
                  <th>LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {formData.contactPersons.map((cp, idx) => (
                  <tr key={idx}>
                    <td>
                      <input type="radio" name="editCp" onChange={() => this.editContact(idx)} />
                    </td>
                    <td>{cp.name}</td>
                    <td>{cp.designation}</td>
                    <td>{cp.phone}</td>
                    <td>{cp.mail}</td>
                    <td>{cp.linkedin}</td>
                  </tr>
                ))}
                {formData.contactPersons.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center">
                      No contacts added
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="fixed-card-footer">
            
              <button type="button" className="btn btn-secondary btn-sm mr-2" onClick={() => this.setState({ showForm: false })}>
                Cancel
              </button>
                <button type="submit" className="btn btn-success btn-sm ">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  renderPreview = () => {
    const { formData, previewTab } = this.state;
    const renderRow = (label, val) => (
      <tr>
        <td style={{ width: "30%" }}>
          <b>{label}</b>
        </td>
        <td>{val || "-"}</td>
      </tr>
    );
    const renderContacts = () => (
  <table className="table table-bordered table-sm">
    <tbody>
      {formData.contactPersons.map((c, i) => (
        <React.Fragment key={i}>
          <tr>
            <td colSpan="2"><b>Person {i + 1}</b></td>
          </tr>
          {renderRow("Name", c.name)}
          {renderRow("Designation", c.designation)}
          {renderRow("Phone", c.phone)}
          {renderRow("Mail", c.mail)}
          {renderRow("LinkedIn", c.linkedin)}
        </React.Fragment>
      ))}
    </tbody>
  </table>
);

    return (
      <div className="card p-4">
        <div className="d-flex justify-content-between mb-3">
          <h4>Account Preview</h4>
          <div>
            <button className="btn btn-outline-primary btn-sm mr-2" onClick={() => this.toggleForm(formData)}>
              Edit
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => this.setState({ showPreview: false })}>
              Back
            </button>
          </div>
        </div>

        <table className="table table-bordered table-sm mb-3">
          <tbody>
            {renderRow("Account No", formData.acno)}
            {renderRow("Account Name", formData.acname)}
            {renderRow("Short Name", formData.acshortname)}
            {renderRow("Email", formData.email)}
            {renderRow("Website", formData.website)}
            {renderRow("Phone", formData.phone)}
            {renderRow("LinkedIn", formData.comlinkedin)}
          </tbody>
        </table>

        <ul className="nav nav-tabs mb-3">
          {["showAll", "remarks", "contacts", "comments"].map((k) => (
            <li className="nav-item" key={k}>
              <button className={`nav-link ${previewTab === k ? "active" : ""}`} onClick={() => this.setState({ previewTab: k })}>
                {k === "showAll" ? "Show All" : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            </li>
          ))}
        </ul>

        {previewTab === "contacts" && renderContacts()}
        {previewTab === "remarks" && (
          <div>
            {this.state.remarks.length === 0 ? (
              <p>No remarks available.</p>
            ) : (
              <ul className="list-group">
                {this.state.remarks.map((r, i) => (
                  <li key={i} className="list-group-item">
                    <strong>{r.date}:</strong> {r.contact}, {r.source}
                    <br />
                    {r.remarks}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {previewTab === "comments" && (
          <div>
            <textarea className="form-control mb-2" placeholder="Add comment" onChange={(e) => this.setState({ newComment: e.target.value })}></textarea>
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                this.setState((prev) => ({ comments: [...prev.comments, prev.newComment], newComment: "" }))
              }
            >
              Add Comment
            </button>
            <ul className="mt-2">
              {this.state.comments.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {previewTab === "showAll" && (
  <>
    {renderContacts()}
    <hr />
    <div>
      <h6>Remarks</h6>
      {this.state.remarks.length === 0 ? (
        <p>No remarks available.</p>
      ) : (
        <ul className="list-group">
          {this.state.remarks.map((r, i) => (
            <li key={i} className="list-group-item">
              <strong>{r.date}:</strong> {r.contact}, {r.source}
              <br />
              {r.remarks}
            </li>
          ))}
        </ul>
      )}
    </div>
    <hr />
    <div>
      <h6>Comments</h6>
      {this.state.comments.length === 0 ? (
        <p>No comments added.</p>
      ) : (
        <ul>
          {this.state.comments.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  </>
)}

      </div>
    );
  };

  renderTable = () => {
    const { accounts, search } = this.state;
    const filtered = accounts.filter((a) => a.acname.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="card mt-4 full-height">
        <div className="card-body">
          <div className="d-flex justify-content-between mb-3">
            <h4>Accounts</h4>
            <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>
              + Add Account
            </button>
          </div>
          <input className="form-control mb-2" placeholder="Search account name..." value={search} onChange={(e) => this.setState({ search: e.target.value })} />
          <table className="table table-bordered table-sm">
            <thead className="thead-light">
              <tr>
                <th>A/c No</th>
                <th>Account Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Country</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((acc) => (
                <tr key={acc.id}>
                  <td>
                    <button className="btn btn-link p-0" onClick={() => this.togglePreview(acc)}>
                      {acc.acno}
                    </button>
                  </td>
                  <td>{acc.acname}</td>
                  <td>{acc.contact}</td>
                  <td>{acc.email}</td>
                  <td>{acc.phone}</td>
                  <td>{Country.getCountryByCode(acc.country)?.name || ""}</td>
                  <td>
                    <Dropdown>
                      <Dropdown.Toggle variant="outline-primary" size="sm">Actions</Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={() => this.toggleForm(acc)}>Edit</Dropdown.Item>
                        <Dropdown.Item onClick={() => this.toggleForm(acc)}>Add Contact</Dropdown.Item>
                        <Dropdown.Item onClick={() => this.handleDelete(acc.id)}>Delete</Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  render() {
    return (
      <div className="container-fluid">
        {this.state.showForm ? this.renderForm() : this.state.showPreview ? this.renderPreview() : this.renderTable()}
      </div>
    );
  }
}

export default Datalist;
