import React, { Component } from 'react';
import { db } from '../../../../firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';  
class servicecontractapproval extends Component {
  state = {
    contracts: [],
    selected: null,
    loading: false,
    showRejectDialog: false,
    rejectReason: "",
  };
fetchAwaiting = async () => {
  const snap = await getDocs(collection(db, 'contracts'));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // earlier you filtered only awaiting. Now show all.
  this.setState({ contracts: data });
};

formatDate = (d) => {
  if (!d) return '';
  try {
    return format(new Date(d), 'dd-MMM-yy');
  } catch {
    return d;
  }
};
  componentDidMount() { this.fetchAwaiting(); }

  openPreview = (contract) => {
    this.setState({ selected: contract });
  };

  closePreview = () => {
    this.setState({ selected: null, showRejectDialog: false, rejectReason: "" });
  };

  approve = async (contract) => {
    if (!window.confirm(`Approve ${contract.contractNo}?`)) return;
    this.setState({ loading: true });
    try {
      const cRef = doc(db, 'contracts', contract.id);
      await updateDoc(cRef, {
        status: 'Approved',
        approvedAt: serverTimestamp(),
        approvedLineItems: contract.lineItems || [],
        updatedAt: serverTimestamp()
      });
      alert('Approved.');
      this.fetchAwaiting();
      this.closePreview();
    } catch (err) {
      console.error(err);
      alert('Error approving: ' + err.message);
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

  handleRejectReasonChange = (e) => {
    this.setState({ rejectReason: e.target.value });
  };

  handleRejectConfirm = async () => {
    const { selected, rejectReason } = this.state;
    if (!rejectReason.trim()) {
      alert("Please enter a reason for rejection.");
      return;
    }
    try {
      await updateDoc(doc(db, 'contracts', selected.id), {
        status: 'Rejected',
        rejectedAt: serverTimestamp(),
        rejectReason,
        updatedAt: serverTimestamp()
      });
      alert('Rejected.');
      this.fetchAwaiting();
      this.closePreview();
    } catch (err) {
      alert(err.message);
    }
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





renderTable = () => (
  <div className="card mt-4 full-height">
    <div className="card-body">
      <h4 className="card-title">Service Contract Approval</h4>
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="thead-light">
            <tr>
              <th>Contract No</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Value</th>
              <th>Std Days</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {this.state.contracts.map(c => {
              let statusClass = "badge-secondary";
              if (c.status === "Awaiting Approval") statusClass = "badge-warning";
              else if (c.status === "Approved") statusClass = "badge-success";
              else if (c.status === "Partial") statusClass = "badge-purple";
              else if (c.status === "Completed") statusClass = "badge-info";
              else if (c.status === "Rejected") statusClass = "badge-danger";

              return (
                <tr key={c.id}>
                  <td>
                    <button className="btn btn-link p-0" onClick={() => this.openPreview(c)}>
                      {c.contractNo}
                    </button>
                  </td>
                  <td>{c.customer}</td>
                  <td>{this.formatDate(c.createdDate || c.contrDurationFrom)}</td>
                  <td>{c.contractValue || c.amtAgreed}</td>
                  <td>{c.stdDays}</td>
                  <td>
                    <label className={`badge ${statusClass}`} style={{ fontSize: '14px' }}>{c.status}</label>
                  </td>
                </tr>
              );
            })}
            {this.state.contracts.length === 0 && (
              <tr><td colSpan="6" className="text-center">No contracts</td></tr>
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
        <h4 className="card-title mb-0">Contract Preview - {c.contractNo}</h4>
       <div className="row mb-3">
          <div className="col-md-4"><b>Customer:</b> {c.customer}</div>
          <div className="col-md-4"><b>Contract No:</b> {c.contractNo}</div>
          <div className="col-md-4"><b>Status:</b> {c.status}</div>
        </div>
        <div className="row mb-3">
          <div className="col-md-4"><b>Duration:</b> {c.durationFrom} to {c.durationTo}</div>
          <div className="col-md-4"><b>Till Date:</b> {c.tillDate || '-'}</div>
          <div className="col-md-4"><b>Repeat:</b> {c.repeat ? 'Yes' : 'No'}</div>
        </div>
        <h5 className="mt-2">Line Items</h5>
        <table className="table table-bordered table-sm">
          <thead className='thead-light'>
  <tr>
    <th>Item Code</th>
    <th>Description</th>
    <th>HSN</th>
    <th>UOM</th>
    <th>Duration</th>
    <th>Qty</th>
    <th>Unit Price</th>
    <th>Days</th>
    <th>Months</th>
    <th>Tax</th>
    <th>Tax Amt</th>
    <th>Item Total</th>
  </tr>
</thead>
<tbody>
  {(c.lineItems || []).map((li, i) => (
    <tr key={i}>
      <td>{li.itemCode}</td>
      <td>{li.itemDesc || li.itemDescription}</td>
      <td>{li.hsnCode}</td>
      <td>{li.uom}</td>
      <td>{li.duration || `${c.durationFrom} to ${c.durationTo}`}</td>
      <td>{li.qty}</td>
      <td>{li.unitPrice}</td>
      <td>{li.days}</td>
      <td>{li.months}</td>
      <td>{(li.taxGroupNames || []).join(', ')}</td>
      <td>{li.taxAmt}</td>
      <td>{li.itemTotal}</td>
    </tr>
  ))}
</tbody>
  
        </table>
        <div className="mt-auto pt-3 text-right">
          <button
            className="btn btn-success mr-2"
            onClick={() => this.approve(c)}
            disabled={c.status === "Approved"}
          >
            Approve
          </button>
          <button
            className="btn btn-danger mr-2"
            onClick={this.openRejectDialog}
            disabled={c.status === "Rejected"}
          >
            Reject
          </button>
          <button
            className="btn btn-secondary"
            onClick={this.closePreview}
          >
            Back to List
          </button>
        </div>
        {this.state.showRejectDialog && this.renderRejectDialog()}
      </div>
    );
  };

  render() {
    return (
      <div className="container-fluid">
        {this.state.selected ? this.renderPreview() : this.renderTable()}
      </div>
    );
  }
}

export default servicecontractapproval;
