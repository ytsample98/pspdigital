// ThirdPartyBillingApproval.js
import React, { Component } from "react";
import { db } from "../../../../../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

class ThirdPartyBillingApproval extends Component {
  state = {
    bills: [],
    selected: null,
    formData: null,
    loading: false,
    showRejectDialog: false,
    rejectReason: "",
    taxGroups: [],
  };

  componentDidMount() {
    this.fetchBills();
    this.fetchTaxGroups();
  }

  fetchBills = async () => {
    const snap = await getDocs(collection(db, "thirdPartyBills"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    this.setState({ bills: data.reverse() });
  };

  fetchTaxGroups = async () => {
    const snap = await getDocs(collection(db, "taxGroups"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ taxGroups: data });
  };

  openPreview = (bill) => {
    const copy = JSON.parse(JSON.stringify(bill || {}));
    this.setState({ selected: bill, formData: copy });
  };

  closePreview = () => this.setState({ selected: null, formData: null, showRejectDialog: false, rejectReason: "" });

  handleInputChange = (field, value) => this.setState(prev => ({ formData: { ...prev.formData, [field]: value } }));

  handleLineItemChange = (idx, field, value) => {
    const items = [...(this.state.formData.lineItems || [])];
    items[idx] = { ...items[idx], [field]: value };
    const qty = parseFloat(items[idx].qty || 0);
    const unitPrice = parseFloat(items[idx].unitPrice || 0);
    items[idx].itemTotal = (qty * unitPrice).toFixed(2);
    this.setState(prev => ({ formData: { ...prev.formData, lineItems: items } }));
  };

  recalcTotals = () => {
    const f = this.state.formData || {};
    let total = 0;
    const tgMap = this.state.taxGroups.reduce((m, tg) => { m[tg.id || tg.name] = tg; return m; }, {});
    const items = (f.lineItems || []).map(it => {
      const itemTotal = parseFloat(it.itemTotal || 0);
      const tg = it.taxGroup ? (tgMap[it.taxGroup] || {}) : {};
      const pct = parseFloat(tg.percentage || 0);
      const taxAmt = (itemTotal * pct) / 100;
      total += itemTotal + taxAmt;
      return { ...it, taxAmt: taxAmt.toFixed(2) };
    });
    if (f.conversionRate) total = total * parseFloat(f.conversionRate || 1);
    this.setState(prev => ({ formData: { ...prev.formData, lineItems: items, totalValue: total ? total.toFixed(2) : "0.00" } }));
  };

  saveChanges = async (setAwaiting = true) => {
    const { selected, formData } = this.state;
    if (!selected || !formData) return;
    this.setState({ loading: true });
    try {
      const cRef = doc(db, "thirdPartyBills", selected.id);
      const updatePayload = { ...formData, updatedAt: serverTimestamp() };
      if (setAwaiting) updatePayload.status = "Awaiting Approval";
      await updateDoc(cRef, updatePayload);
      await this.fetchBills();
      this.openPreview({ ...formData, id: selected.id });
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
      const cRef = doc(db, "thirdPartyBills", selected.id);
      await updateDoc(cRef, { ...formData, status: "Approved", approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
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

  openRejectDialog = () => this.setState({ showRejectDialog: true, rejectReason: "" });
  closeRejectDialog = () => this.setState({ showRejectDialog: false, rejectReason: "" });

  handleRejectConfirm = async () => {
    const { selected, formData, rejectReason } = this.state;
    if (!selected) return;
    if (!rejectReason || !rejectReason.trim()) {
      alert("Please enter a reason for rejection.");
      return;
    }
    this.setState({ loading: true });
    try {
      const cRef = doc(db, "thirdPartyBills", selected.id);
      await updateDoc(cRef, { ...formData, status: "Rejected", rejectReason, rejectedAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
    if (status === "Awaiting Approval" || status === "Entered") cls = "badge-warning";
    else if (status === "Approved") cls = "badge-success";
    else if (status === "Rejected") cls = "badge-success";
    else if (status === "Partial") cls = "badge-purple";
    else if (status === "Completed") cls = "badge-info";
    return <label className={`badge ${cls}`} style={{ fontSize: '14px' }}>{status}</label>;
  };

  renderRejectDialog = () => (
    <div className="custom-overlay">
      <div className="custom-overlay-content" style={{ width: 420 }}>
        <h5>Reject Reason</h5>
        <textarea className="form-control" rows={3} value={this.state.rejectReason} onChange={e => this.setState({ rejectReason: e.target.value })} placeholder="Enter reason for rejection" />
        <div className="mt-3 text-right">
          <button className="btn btn-secondary mr-2" onClick={this.closeRejectDialog}>Cancel</button>
          <button className="btn btn-danger" onClick={this.handleRejectConfirm}>Reject</button>
        </div>
      </div>
    </div>
  );

  renderPreview = () => {
    const f = this.state.formData;
    if (!f) return null;
    const items = f.lineItems || [];
    return (
      <div className="card p-4 full-height d-flex flex-column">
        <h4>Third Party Billing - Approval</h4>

        <div className="row mb-2">
          <div className="col-md-3"><b>Bill No:</b> {f.billNo}</div>
          <div className="col-md-3"><b>Date:</b> <input className="form-control" type="date" value={f.billDate} onChange={e => this.handleInputChange('billDate', e.target.value)} /></div>
          <div className="col-md-3"><b>Vendor:</b> <input className="form-control" value={f.vendorName} onChange={e => this.handleInputChange('vendorName', e.target.value)} /></div>
          <div className="col-md-3"><b>Status:</b> {this.getStatusBadge(f.status)}</div>
        </div>

        <div className="form-row">
          <div className="form-group col-md-4">
            <label>Ref No</label>
            <input className="form-control" value={f.refNo} onChange={e => this.handleInputChange('refNo', e.target.value)} />
          </div>
          <div className="form-group col-md-4">
            <label>Currency</label>
            <input className="form-control" value={f.currency} onChange={e => this.handleInputChange('currency', e.target.value)} />
          </div>
          <div className="form-group col-md-4">
            <label>Conversion Rate</label>
            <input className="form-control" type="number" value={f.conversionRate} onChange={e => this.handleInputChange('conversionRate', e.target.value)} />
          </div>
        </div>

        <h5 className="mt-3">Line Items</h5>
        <div className="table-responsive">
          <table className="table table-bordered table-sm">
            <thead><tr><th>Code</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Item Total</th><th>Tax</th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td><input className="form-control" value={it.serviceCode} onChange={e => this.handleLineItemChange(idx, 'serviceCode', e.target.value)} /></td>
                  <td><input className="form-control" value={it.description} onChange={e => this.handleLineItemChange(idx, 'description', e.target.value)} /></td>
                  <td><input className="form-control" type="number" value={it.qty} onChange={e => this.handleLineItemChange(idx, 'qty', e.target.value)} /></td>
                  <td><input className="form-control" type="number" value={it.unitPrice} onChange={e => this.handleLineItemChange(idx, 'unitPrice', e.target.value)} /></td>
                  <td>{it.itemTotal}</td>
                  <td>{it.taxAmt || "0.00"}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="text-center">No items</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mt-auto pt-3 text-right">
          <button className="btn btn-secondary mr-2" onClick={() => { this.recalcTotals(); this.saveChanges(true); }} disabled={this.state.loading}>Save (Send for Approval)</button>
          <button className="btn btn-success mr-2" onClick={this.approve} disabled={this.state.loading || f.status === "Approved"}>Approve</button>
          <button className="btn btn-danger mr-2" onClick={this.openRejectDialog} disabled={this.state.loading || f.status === "Rejected"}>Reject</button>
          <button className="btn btn-secondary" onClick={this.closePreview}>Back to List</button>
        </div>

        {this.state.showRejectDialog && this.renderRejectDialog()}
      </div>
    );
  };

  renderTable = () => (
    <div className="card full-height mt-3">
      <div className="card-body">
        <h4>Third Party Billing Approvals</h4>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr><th>Bill No</th><th>Date</th><th>Vendor</th><th>Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {this.state.bills.map(b => (
                <tr key={b.id}>
                  <td><button className="btn btn-link p-0" onClick={() => this.openPreview(b)}>{b.billNo}</button></td>
                  <td>{b.billDate}</td>
                  <td>{b.vendorName}</td>
                  <td>{b.totalValue}</td>
                  <td>{this.getStatusBadge(b.status)}</td>
                </tr>
              ))}
              {this.state.bills.length === 0 && <tr><td colSpan={5} className="text-center">No records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  render() {
    return <div className="container-fluid">{this.state.selected ? this.renderPreview() : this.renderTable()}</div>;
  }
}

export default ThirdPartyBillingApproval;
