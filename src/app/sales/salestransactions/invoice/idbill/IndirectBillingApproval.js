// IndirectBillingApproval.js
import React, { Component } from "react";
import { db } from "../../../../../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

class IndirectBillingApproval extends Component {
  state = {
    bills: [],
    selected: null,
    loading: false,
    showRejectDialog: false,
    rejectReason: "",
    // local editable copy to allow inline editing within approval screen
    formData: null,
  };

  componentDidMount() {
    this.fetchBills();
  }

  fetchBills = async () => {
    const snap = await getDocs(collection(db, "indirectBills"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ bills: data.reverse() });
  };

  openPreview = (bill) => {
    // create deep copy for editing inside approval screen
    const copy = JSON.parse(JSON.stringify(bill || {}));
    this.setState({ selected: bill, formData: copy });
  };

  closePreview = () => {
    this.setState({ selected: null, formData: null, showRejectDialog: false, rejectReason: "" });
  };

  handleInputChange = (field, value) => {
    this.setState((prev) => ({
      formData: { ...prev.formData, [field]: value },
    }));
  };

  handleLineItemChange = (idx, field, value) => {
    const items = [...(this.state.formData.lineItems || [])];
    items[idx] = { ...items[idx], [field]: value };
    // recalc itemTotal locally (same logic as IndirectBilling)
    const qty = parseFloat(items[idx].shipQty || 0);
    const unitPrice = parseFloat(items[idx].unitPrice || 0);
    items[idx].itemTotal = (qty * unitPrice).toFixed(2);
    this.setState((prev) => ({ formData: { ...prev.formData, lineItems: items } }));
  };

  recalcTotals = () => {
    const f = this.state.formData || {};
    const items = f.lineItems || [];
    let totalValue = 0;
    items.forEach(it => { totalValue += parseFloat(it.itemTotal || 0); });
    const freightCharges = parseFloat(f.freightCharges || 0);
    const freightPercent = parseFloat(f.freightPercent || 0);
    const packingCharges = parseFloat(f.packingCharges || 0);
    const freightTaxAmt = (freightCharges * freightPercent) / 100;
    totalValue += freightCharges + packingCharges + freightTaxAmt;
    if (f.conversionRate) totalValue = totalValue * parseFloat(f.conversionRate);
    this.setState(prev => ({ formData: { ...prev.formData, totalValue: totalValue ? totalValue.toFixed(2) : "", freightTaxAmt: freightTaxAmt ? freightTaxAmt.toFixed(2) : "0.00" } }));
  };

  saveChanges = async (setAwaiting = true) => {
    // Save edits inline. If setAwaiting === true, set status to "Awaiting Approval"
    const { selected, formData } = this.state;
    if (!selected || !formData) return;
    this.setState({ loading: true });
    try {
      const cRef = doc(db, "indirectBills", selected.id);
      const updatePayload = {
        ...formData,
        updatedAt: serverTimestamp(),
      };
      if (setAwaiting) updatePayload.status = "Awaiting Approval";
      await updateDoc(cRef, updatePayload);
      await this.fetchBills();
      this.openPreview({ ...formData, id: selected.id }); // refresh local copy
      alert("Saved.");
    } catch (err) {
      console.error(err);
      alert("Error saving: " + err.message);
    } finally {
      this.setState({ loading: false });
    }
  };

  approve = async () => {
    const { selected, formData } = this.state;
    if (!selected || !formData) return;
    if (!window.confirm(`Approve ${formData.billNo || selected.billNo}?`)) return;
    this.setState({ loading: true });
    try {
      const cRef = doc(db, "indirectBills", selected.id);
      await updateDoc(cRef, {
        ...formData,
        status: "Approved",
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert("Approved.");
      await this.fetchBills();
      this.closePreview();
    } catch (err) {
      console.error(err);
      alert("Error approving: " + err.message);
    } finally {
      this.setState({ loading: false });
    }
  };

  openRejectDialog = () => {
    this.setState({ showRejectDialog: true, rejectReason: "" });
  };

  closeRejectDialog = () => {
    this.setState({ showRejectDialog: false, rejectReason: "" });
  };

  handleRejectReasonChange = (e) => this.setState({ rejectReason: e.target.value });

  handleRejectConfirm = async () => {
    const { selected, formData, rejectReason } = this.state;
    if (!selected) return;
    if (!rejectReason || !rejectReason.trim()) {
      alert("Please enter a reason for rejection.");
      return;
    }
    this.setState({ loading: true });
    try {
      const cRef = doc(db, "indirectBills", selected.id);
      await updateDoc(cRef, {
        ...formData,
        status: "Rejected", // per user's rule (badge will be success)
        rejectReason,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert("Rejected.");
      await this.fetchBills();
      this.closePreview();
    } catch (err) {
      console.error(err);
      alert("Error rejecting: " + err.message);
    } finally {
      this.setState({ loading: false });
    }
  };

  getStatusBadge = (status) => {
    let cls = "badge-secondary";
    if (!status) status = "Entered";
    if (status === "Awaiting Approval") cls = "badge-warning";
    else if (status === "Approved") cls = "badge-success";
    else if (status === "Rejected") cls = "badge-danger"; // user requested rejected as success
    else if (status === "Partial") cls = "badge-purple";
    else if (status === "Completed") cls = "badge-info";
    return <label className={`badge ${cls}`} style={{ fontSize: '14px' }}>{status}</label>;
  };

  renderRejectDialog = () => (
    <div className="custom-overlay">
      <div className="custom-overlay-content" style={{ width: 400 }}>
        <h5>Reject Reason</h5>
        <textarea
          className="form-control"
          rows={3}
          value={this.state.rejectReason}
          onChange={this.handleRejectReasonChange}
          placeholder="Enter reason for rejection"
        />
        <div className="text-right mt-3">
          <button className="btn btn-secondary mr-2" onClick={this.closeRejectDialog}>Cancel</button>
          <button className="btn btn-danger" onClick={this.handleRejectConfirm}>Reject</button>
        </div>
      </div>
    </div>
  );

renderPreview = () => {
  const f = this.state.formData;
  if (!f) return null;

  return (
    <div className="card full-height">
      <form className="form-sample">
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <h4 className="mb-3">Indirect Billing - Approval</h4>
          
          {/* Tabs like IndirectBilling */}
          {this.renderTabs()}
          {this.state.activeTab === 0 && this.renderBillingDetailsTab()}
          {this.state.activeTab === 1 && this.renderPortTab()}
          {this.state.activeTab === 2 && this.renderNotesTab()}
        </div>

        <div className="fixed-card-footer text-right p-3 border-top bg-white">
          <button
            className="btn btn-secondary mr-2"
            onClick={() => { this.recalcTotals(); this.saveChanges(true); }}
            disabled={this.state.loading}
          >
            Save
          </button>
          <button
            className="btn btn-success mr-2"
            onClick={this.approve}
            disabled={this.state.loading || f.status === "Approved"}
          >
            Approve
          </button>
          <button
            className="btn btn-danger mr-2"
            onClick={this.openRejectDialog}
            disabled={this.state.loading || f.status === "Rejected"}
          >
            Reject
          </button>
          <button className="btn btn-secondary" onClick={this.closePreview}>
            Back to List
          </button>
        </div>

        {this.state.showRejectDialog && this.renderRejectDialog()}
      </form>
    </div>
  );
};

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <h4 className="card-title">Indirect Billing Approvals</h4>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr>
                <th>Bill No</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Total Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {this.state.bills.map(b => (
                <tr key={b.id}>
                  <td><button className="btn btn-link p-0" onClick={() => this.openPreview(b)}>{b.billNo}</button></td>
                  <td>{b.billDate}</td>
                  <td>{b.supplier}</td>
                  <td>{b.totalValue}</td>
                  <td>{this.getStatusBadge(b.status)}</td>
                </tr>
              ))}
              {this.state.bills.length === 0 && <tr><td colSpan="5" className="text-center">No records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  render() {
    return (
      <div className="container-fluid">
        {this.state.selected ? this.renderPreview() : this.renderTable()}
      </div>
    );
  }
}

export default IndirectBillingApproval;
