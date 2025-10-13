import React, { Component } from 'react';
import { db } from '../../../../firebase';
import { collection, getDocs, updateDoc, doc,onSnapshot } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';

class BillingCancel extends Component {
  state = {
    cobilling: [],
    selected: null,
    loading: false,
    showCancelDialog: false,
    cancelReason: "",
  };

componentDidMount() {
  this.subscribeToBills();
}

componentWillUnmount() {
  if (this._unsubCob) this._unsubCob();
  if (this._unsubInv) this._unsubInv();
}

subscribeToBills = () => {
  // cobilling listener
  this._unsubCob = onSnapshot(collection(db, 'cobilling'), snap => {
    const cobData = snap.docs.map(d => ({ id: d.id, ...d.data(), source: 'cob' }));
    this._latestCob = cobData;
    this.mergeAndSet();
  }, err => {
    console.error('cob snapshot error', err);
  });

  // invoices listener
  this._unsubInv = onSnapshot(collection(db, 'invoices'), snap => {
    const invData = snap.docs.map(d => ({ id: d.id, ...d.data(), source: 'direct' }));
    this._latestInv = invData;
    this.mergeAndSet();
  }, err => {
    console.error('inv snapshot error', err);
  });
};

mergeAndSet = () => {
  const cob = this._latestCob || [];
  const inv = this._latestInv || [];
  const merged = [...cob, ...inv].sort((a,b) => {
    const da = a.cobillingDate || a.invoiceDate || '';
    const db_ = b.cobillingDate || b.invoiceDate || '';
    return db_.localeCompare(da);
  });
  this.setState({ cobilling: merged });
};


  fetchBills = async () => {
    try {
      const snapCOB = await getDocs(collection(db, 'cobilling'));
      const cobData = snapCOB.docs.map(d => ({ id: d.id, ...d.data(), source: 'cob' }));
      const snapINV = await getDocs(collection(db, 'invoices'));
      const invData = snapINV.docs.map(d => ({ id: d.id, ...d.data(), source: 'direct' }));
      // show bills that can be cancelled (Approved) — mirror approval/amendment flows
      const cancelable = [...cobData, ...invData].filter(c => c.status === 'Approved');
      this.setState({ cobilling: cancelable });
    } catch (err) {
      console.error('fetchBills error', err);
      alert('Error fetching bills: ' + err.message);
    }
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
      const collectionName = selected.source === 'direct' ? 'invoices' : 'cobilling';
      const ref = doc(db, collectionName, selected.id);
      await updateDoc(ref, {
        status: 'Cancelled',
        cancelledAt: serverTimestamp(),
        cancelReason,
        updatedAt: serverTimestamp()
      });

      alert('Bill Cancelled.');
      await this.fetchBills();
      this.closePreview();
    } catch (err) {
      console.error('handleCancelConfirm error', err);
      alert('Error cancelling: ' + err.message);
    }
  };

  renderCancelDialog = () => (
    <div className="custom-overlay">
      <div className="custom-overlay-content" style={{ width: 420 }}>
        <h5>Cancel Reason</h5>
        <textarea
          className="form-control"
          rows={4}
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
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
  {this.state.cobilling.map(c => {
    let statusClass = "badge-secondary";
    if (c.status === "Approved") statusClass = "badge-success";
    else if (c.status === "Amended") statusClass = "badge-warning";
    else if (c.status === "Cancelled") statusClass = "badge-dark";
    else if (c.status === "Entered" || c.status === "Pending") statusClass = "badge-info";

    const billNo = c.source === 'direct' ? (c.invoiceNo || '-') : (c.cobillingNo || '-');
    const date = c.source === 'direct' ? (c.invoiceDate || '-') : (c.cobillingDate || '-');
    const value = c.source === 'direct' ? (c.invoiceValue || c.amount || '-') : (c.billValue || c.amount || '-');

    return (
      <tr key={`${c.source}_${c.id}`}>
        <td>
          <button className="btn btn-link p-0" onClick={() => this.openPreview(c)}>{billNo}</button>
        </td>
        <td>{c.customerOrderId || "-"}</td>
        <td>{c.customer || "-"}</td>
        <td>{date}</td>
        <td>{value}</td>
        <td>{c.source === 'direct' ? "Direct Billing" : "Customer Billing"}</td>
        <td>
          <label className={`badge ${statusClass}`} style={{ fontSize: '14px' }}>{c.status || 'N/A'}</label>
        </td>
      </tr>
    );
  })}
</tbody>

          </table>
        </div>
      </div>
    </div>
  );

  renderPreview = () => {
    const c = this.state.selected;
    if (!c) return null;
    const billNo = c.source === 'direct' ? (c.invoiceNo || '-') : (c.cobillingNo || '-');
    const date = c.source === 'direct' ? (c.invoiceDate || '-') : (c.cobillingDate || '-');
    const value = c.source === 'direct' ? (c.invoiceValue || '-') : (c.billValue || '-');

    return (
      <div className="card mt-4 p-4 shadow-sm full-height d-flex flex-column">
        <h4 className="card-title mb-0">Billing Preview - {billNo}</h4>
        <div className="row mb-3">
          <div className="col-md-4"><b>Order:</b> {c.customerOrderId || "-"}</div>
          <div className="col-md-4"><b>Customer:</b> {c.customer || "-"}</div>
          <div className="col-md-4"><b>Date:</b> {date}</div>
        </div>
        <div className="row mb-3">
          <div className="col-md-4"><b>Value:</b> {value}</div>
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
