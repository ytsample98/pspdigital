import React, { Component } from 'react';
import { db } from '../../../../firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';

class BillingCancel extends Component {
  state = {
    cobilling: [],
    selected: null,
    loading: false,
    showCancelDialog: false,
    cancelReason: "",
  };

  componentDidMount() { this.fetchBills(); }

  fetchBills = async () => {
    const snap = await getDocs(collection(db, 'cobilling'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const cancellable = data.filter(c => c.status === 'Approved' || c.status === 'Amended');
    this.setState({ cobilling: cancellable });
  };

  openPreview = (cob) => {
    this.setState({ selected: cob });
  };

  closePreview = () => {
    this.setState({ selected: null, showCancelDialog: false, cancelReason: "" });
  };

  openCancelDialog = () => {
    this.setState({ showCancelDialog: true, cancelReason: "" });
  };

  closeCancelDialog = () => {
    this.setState({ showCancelDialog: false, cancelReason: "" });
  };

  handleCancelReasonChange = (e) => {
    this.setState({ cancelReason: e.target.value });
  };

  handleCancelConfirm = async () => {
    const { selected, cancelReason } = this.state;
    if (!cancelReason.trim()) {
      alert("Please enter a reason for cancellation.");
      return;
    }
    try {
      const ref = doc(db, selected.source === 'direct' ? 'invoices' : 'cobilling', selected.id);
      await updateDoc(ref, {
        status: 'Cancelled',
        cancelledAt: serverTimestamp(),
        cancelReason,
        updatedAt: serverTimestamp()
      });

      alert('Bill Cancelled.');
      this.fetchBills();
      this.closePreview();
    } catch (err) {
      alert(err.message);
    }
  };

  renderCancelDialog = () => (
    <div className="custom-overlay">
      <div className="custom-overlay-content" style={{ width: 400 }}>
        <h5>Cancel Reason</h5>
        <textarea
          className="form-control"
          rows={3}
          value={this.state.cancelReason}
          onChange={this.handleCancelReasonChange}
          placeholder="Enter reason for cancellation"
        />
        <div className="text-right mt-3">
          <button className="btn btn-secondary mr-2" onClick={this.closeCancelDialog}>Cancel</button>
          <button className="btn btn-danger" onClick={this.handleCancelConfirm}>Confirm Cancel</button>
        </div>
      </div>
    </div>
  );

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <h4 className="card-title">Billing Cancel</h4>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr>
                <th>Bill No</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {this.state.cobilling.map(c => {
                let statusClass = "badge-secondary";
                if (c.status === "Approved") statusClass = "badge-success";
                else if (c.status === "Amended") statusClass = "badge-warning";
                else if (c.status === "Cancelled") statusClass = "badge-danger";
                return (
                  <tr key={c.id}>
                    <td>
                      <button className="btn btn-link p-0" onClick={() => this.openPreview(c)}>
                        {c.cobillingNo}
                      </button>
                    </td>
                    <td>{c.customerOrderId}</td>
                    <td>{c.customer}</td>
                    <td>{c.cobillingDate}</td>
                    <td>{c.billValue}</td>
                    <td>
                      <label className={`badge ${statusClass}`} style={{ fontSize: '14px' }}>{c.status}</label>
                    </td>
                  </tr>
                );
              })}
              {this.state.cobilling.length === 0 && (
                <tr><td colSpan="7" className="text-center">No bills for cancellation</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  renderPreview = () => {
    const c = this.state.selected;
    if (!c) return null;
    return (
      <div className="card mt-4 p-4 shadow-sm full-height d-flex flex-column">
        <h4 className="card-title mb-0">Billing Preview - {c.cobillingNo}</h4>
        <div className="row mb-3">
          <div className="col-md-4"><b>Order:</b> {c.customerOrderId}</div>
          <div className="col-md-4"><b>Customer:</b> {c.customer}</div>
          <div className="col-md-4"><b>Date:</b> {c.cobillingDate}</div>
        </div>
        <div className="row mb-3">
          <div className="col-md-4"><b>Value:</b> {c.billValue}</div>
          <div className="col-md-4"><b>Status:</b> {c.status}</div>
          <div className="col-md-4"><b>Cancel Reason:</b> {c.cancelReason || "-"}</div>
        </div>
        <h5 className="mt-2">Line Items</h5>
        <table className="table table-bordered table-sm">
          <thead className="thead-light">
            <tr>
              <th>Item Code</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Item Total</th>
            </tr>
          </thead>
          <tbody>
            {(c.lineItems || []).map((li, i) => (
              <tr key={i}>
                <td>{li.itemCode}</td>
                <td>{li.itemDescription}</td>
                <td>{li.qty}</td>
                <td>{li.unitPrice}</td>
                <td>{li.itemTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-auto pt-3 text-right">
          <button
            className="btn btn-danger mr-2"
            onClick={this.openCancelDialog}
            disabled={c.status === "Cancelled"}
          >
            Cancel
          </button>
          <button
            className="btn btn-secondary"
            onClick={this.closePreview}
          >
            Back to List
          </button>
        </div>
        {this.state.showCancelDialog && this.renderCancelDialog()}
      </div>
    );
  };

  render() {
    return (
      <div className="container-fluid">
        {this.state.selected
          ? this.renderPreview()
          : this.renderTable()}
      </div>
    );
  }
}

export default BillingCancel;