import React, { Component } from "react";
import { Pagination } from "react-bootstrap";
import {
  Table,
  Button,
  Form,
  Card,
  InputGroup,
  Modal,
  Row,
  Col,
} from "react-bootstrap";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy
} from "firebase/firestore";

class Activity extends Component {
  state = {
    activities: [],
    accounts: [],
    contactOptions: [],
    // modal control
    showModal: false,
    modalMode: "new", // 'new' or 'edit'
    selectedId: null,

    form: {
      acname: "",
      contact: "",
      phone: "",
      email: "",
      source: "",
      remarks: "",
      date: new Date().toISOString().split("T")[0],
    },

    searchQuery: "",
    currentPage: 1,
    pageSize: 10,
  };

  componentDidMount() {
    this.fetchActivities();
    this.fetchAccounts();
  }

  fetchActivities = async () => {
  const q = query(collection(db, "activities"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  const activities = snap.docs.map((docSnap, idx) => ({
    id: docSnap.id,
    no: idx + 1,
    ...docSnap.data(),
  }));
  this.setState({ activities });
};

  // fetch accounts (and later used to populate contactOptions)
  fetchAccounts = async () => {
    const snap = await getDocs(collection(db, "accounts"));
    // sort alphabetically by acname for datalist
    const accounts = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        if (!a.acname) return 1;
        if (!b.acname) return -1;
        return a.acname.localeCompare(b.acname);
      });
    this.setState({ accounts });
  };

  // radio select a row
  handleSelectRow = (id) => {
    this.setState({ selectedId: id });
  };
  handleSaveAndAddNew = async () => {
  const { form } = this.state;

  if (!form.acname) {
    alert("Please select Account Name.");
    return;
  }
  if (!form.contact) {
    alert("Please select Contact Person.");
    return;
  }

  await addDoc(collection(db, "activities"), form);

  await this.fetchActivities();
  this.setState({
    form: {
      acname: "",
      contact: "",
      phone: "",
      email: "",
      source: "",
      remarks: "",
      date: new Date().toISOString().split("T")[0],
    },
    contactOptions: [],
  });
};


  // open modal (new or edit)
  openModal = (mode) => {
    if (mode === "edit") {
      const { selectedId, activities } = this.state;
      if (!selectedId) return; // edit requires selection
      const activity = activities.find((a) => a.id === selectedId);
      if (!activity) return;
      // prepare contactOptions for the selected account
      const account = this.state.accounts.find((acc) => acc.acname === activity.acname);
      let contactOptions = [];
      if (account) {
        if (account.contact) {
          contactOptions.push({
            name: account.contact,
            designation: "Main",
            phone: account.phone || "",
            email: account.email || "",
          });
        }
        if (account.contactPersons && account.contactPersons.length > 0) {
          contactOptions = contactOptions.concat(account.contactPersons);
        }
      }
      this.setState({
        modalMode: "edit",
        showModal: true,
        form: {
          acname: activity.acname || "",
          contact: activity.contact || "",
          phone: activity.phone || "",
          email: activity.email || "",
          source: activity.source || "",
          remarks: activity.remarks || "",
          date: activity.date || new Date().toISOString().split("T")[0],
        },
        contactOptions,
      });
    } else {
      // new
      this.setState({
        modalMode: "new",
        showModal: true,
        form: {
          acname: "",
          contact: "",
          phone: "",
          email: "",
          source: "",
          remarks: "",
          date: new Date().toISOString().split("T")[0],
        },
        contactOptions: [],
      });
    }
  };

  closeModal = () => {
    this.setState({ showModal: false });
  };

  // handle form field changes inside modal
  handleFormChange = (field, value) => {
    let updatedForm = { ...this.state.form, [field]: value };

    if (field === "acname") {
      // find account by name and populate contactOptions
      const acc = this.state.accounts.find((a) => a.acname === value);
      let contactOptions = [];
      if (acc) {
        if (acc.contact) {
          contactOptions.push({
            name: acc.contact,
            designation: "Main",
            phone: acc.phone || "",
            email: acc.email || "",
          });
        }
        if (acc.contactPersons && acc.contactPersons.length > 0) {
          contactOptions = contactOptions.concat(acc.contactPersons);
        }
      }
      updatedForm.contact = "";
      updatedForm.phone = "";
      updatedForm.email = "";
      this.setState({ contactOptions, form: updatedForm });
      return;
    }

    if (field === "contact") {
      const cp = this.state.contactOptions.find((c) => c.name === value);
      if (cp) {
        updatedForm.phone = cp.phone || "";
        updatedForm.email = cp.email || "";
      } else {
        updatedForm.phone = "";
        updatedForm.email = "";
      }
    }

    if (field === "remarks") {
      if (value.length > 500) {
        // ignore extra input beyond 500
        return;
      }
    }

    this.setState({ form: updatedForm });
  };

  // save modal (new or edit)
  handleSave = async () => {
    const { modalMode, form, selectedId } = this.state;

    // basic validation
    if (!form.acname) {
      alert("Please select Account Name.");
      return;
    }
    if (!form.contact) {
      alert("Please select Contact Person.");
      return;
    }

    if (modalMode === "new") {
      await addDoc(collection(db, "activities"), form);
    } else {
      // update
      const ref = doc(db, "activities", selectedId);
      await updateDoc(ref, form);
    }

    // refresh & close
    await this.fetchActivities();
    this.closeModal();
  };

  deleteSelected = async () => {
    const { selectedId } = this.state;
    if (!selectedId) return;
    if (!window.confirm("Delete selected entry?")) return;
    await deleteDoc(doc(db, "activities", selectedId));
    this.setState({ selectedId: null });
    this.fetchActivities();
  };

  // Search filter
  handleSearch = (e) => {
    this.setState({ searchQuery: e.target.value, currentPage: 1 });
  };

  // Pagination controls
  handlePageChange = (page) => {
    this.setState({ currentPage: page });
  };

  render() {
    const {
      activities,
      accounts,
      contactOptions,
      showModal,
      modalMode,
      form,
      selectedId,
      searchQuery,
      currentPage,
      pageSize,
    } = this.state;

    // --- Filter activities ---
    const filtered = activities.filter(
      (a) =>
        a.acname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.contact?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.remarks || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- Pagination logic ---
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

    return (
      <div className="container-fluid mt-4">
        <Card className="p-3 shadow-sm bg-white border-0">
          <div className="mb-6">
          <h4>Activities</h4>
          <div className="d-flex align-items-center">
            
            {/* Search box (fixed half width with right margin) */}
            <div style={{ flex: "0 0 50%", maxWidth: "50%" ,marginRight: "10px"}} className="me-3">
              <InputGroup style={{ minWidth: 300 }}>
                <Form.Control
                  type="text"
                  placeholder="Search by account, contact, remarks"
                  value={searchQuery}
                  onChange={this.handleSearch}
                />
              </InputGroup>
              </div>
              <div className="d-flex " style={{ gap: "10px" }}>
              <Button              
                 variant="secondary"
                 onClick={() => this.openModal("new")}>
                New
              </Button>
              <Button
                variant="secondary"
                onClick={() => this.openModal("edit")}
                disabled={!selectedId}
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                onClick={this.deleteSelected}
                disabled={!selectedId}
              >
                Delete
              </Button>

              {/* Search box */}
              </div>
            </div>
          </div>

          <div className="table-responsive" style={{marginTop:"10px",minHeight:"520px"}}>
            <Table bordered hover className="w-100">
              <thead className="thead-light">
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Created Date</th>
                  <th>Account Name</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Mail</th>
                  <th>Activity</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((act) => (
                  <tr key={act.id}>
                    <td className="text-center">
                      <Form.Check
                        type="radio"
                        name="selectedRow"
                        checked={selectedId === act.id}
                        onChange={() => this.handleSelectRow(act.id)}
                      />
                    </td>
                    <td>{act.date}</td>
                    <td>{act.acname}</td>
                    <td>{act.contact}</td>
                    <td>{act.phone}</td>
                    <td>{act.email}</td>
                    <td>{act.source}</td>
                    <td style={{ maxWidth: "300px", whiteSpace: "pre-wrap" }}>
                      {act.remarks}
                    </td>
                    
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-flex justify-content-end mt-3">
          <Pagination>
            <Pagination.First onClick={() => this.handlePageChange(1)} disabled={currentPage === 1} />
            <Pagination.Prev onClick={() => this.handlePageChange(currentPage - 1)} disabled={currentPage === 1} />

            {Array.from({ length: totalPages }, (_, i) => (
              <Pagination.Item
                key={i + 1}
                active={i + 1 === currentPage}
                onClick={() => this.handlePageChange(i + 1)}
              >
                {i + 1}
              </Pagination.Item>
            ))}

            <Pagination.Next onClick={() => this.handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} />
            <Pagination.Last onClick={() => this.handlePageChange(totalPages)} disabled={currentPage === totalPages} />
          </Pagination>
        </div>
        </Card>

        {/* Modal for New / Edit */}
        <Modal 
        show={showModal} 
        onHide={this.closeModal} 
        style={{ backgroundColor: "transparent" }}
        centered >
           <div
    className="modal-content"
    style={{
      backgroundColor: "#fff",  
    }}
  >
          <Modal.Header closeButton>
            <Modal.Title>{modalMode === "new" ? "New Entry" : "Edit Entry"}</Modal.Title>
          </Modal.Header>
          <Modal.Body >
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group controlId="formDate">
                    <Form.Label>Created Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={form.date}
                      onChange={(e) => this.handleFormChange("date", e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group controlId="formSource">
                    <Form.Label>Activity *</Form.Label>
                    <Form.Control
                      as="select"
                      value={form.source}
                      onChange={(e) => this.handleFormChange("source", e.target.value)}
                      required
                    >
                      <option value="">Select Activity</option>
                      <option value="Call">Call</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Demo">Demo</option>
                      <option value="Mail">Mail</option>
                      <option value="Whatsapp">Whatsapp</option>
                    </Form.Control>
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mt-3">
                <Col md={6}>
                <Form.Group controlId="formAccount">
                  <Form.Label>Account Name *</Form.Label>
                  <Form.Control
                    as="select"
                    value={form.acname}
                    onChange={(e) => this.handleFormChange("acname", e.target.value)}
                    required
                  >
                    <option value="">Select Account</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.acname}>
                        {acc.acname}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>


                <Col md={6}>
                  <Form.Group controlId="formContact">
                    <Form.Label>Contact Person *</Form.Label>
                    <Form.Control
                      as="select"
                      value={form.contact}
                      onChange={(e) => this.handleFormChange("contact", e.target.value)}
                      disabled={!form.acname}
                      required
                    >
                      <option value="">Select Contact</option>
                      {contactOptions.map((cp, idx) => (
                        <option key={idx} value={cp.name}>
                          {cp.name}
                          {cp.designation ? ` (${cp.designation})` : ""}
                        </option>
                      ))}
                    </Form.Control>
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mt-3">
                <Col md={6}>
                  <Form.Group controlId="formPhone">
                    <Form.Label>Phone</Form.Label>
                    <Form.Control type="text" value={form.phone} readOnly />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="formEmail">
                    <Form.Label>Mail</Form.Label>
                    <Form.Control type="text" value={form.email} readOnly />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mt-3">
                <Col>
                  <Form.Group controlId="formRemarks">
                    <Form.Label>Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={form.remarks}
                      onChange={(e) => this.handleFormChange("remarks", e.target.value)}
                      placeholder="Remarks (max 500 chars)"
                    />
                    <small>{form.remarks.length}/500</small>
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          
          <Modal.Footer className="d-flex justify-content-between">
  {/* Left corner - Cancel */}
  <Button variant="secondary" onClick={this.closeModal}>
    Cancel
  </Button>

  {/* Right side - Create & Create+AddNew */}
  <div>
    <Button variant="primary" onClick={this.handleSave}>
      {modalMode === "new" ? "Create" : "Update"}
    </Button>
    {modalMode === "new" && (
      <Button
        variant="outline-primary"
        className="ml-2"
        onClick={this.handleSaveAndAddNew}
      >
        Create & Add New
      </Button>
    )}
  </div>
</Modal.Footer>

          </div>
        </Modal>
      
      </div>
    );
  }
}

export default Activity;
