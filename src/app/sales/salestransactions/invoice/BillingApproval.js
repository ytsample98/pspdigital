import React, { Component } from 'react';
import { db } from '../../../../firebase';
import { collection, getDocs, updateDoc, doc ,onSnapshot} from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';

class BillingApproval extends Component {
  state = {
    cobilling: [],
    selected: null,
    loading: false,
    showRejectDialog: false,
    rejectReason: "",
    searchTerm:'',
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

 fetchAwaiting = async () => {
  // 1. Fetch COB bills
  const snapCOB = await getDocs(collection(db, 'cobilling'));
  const cobData = snapCOB.docs.map(d => ({ id: d.id, ...d.data(), source: 'cob' }));
  const cobAwaiting = cobData.filter(c => c.status === 'Awaiting Approval');

  // 2. Fetch Direct Billing invoices
  const snapINV = await getDocs(collection(db, 'invoices'));
  const invData = snapINV.docs.map(d => ({ id: d.id, ...d.data(), source: 'direct' }));
  const invAwaiting = invData.filter(inv => inv.status === 'Awaiting Approval');

  // 3. Merge
  this.setState({ cobilling: [...cobAwaiting, ...invAwaiting] });
};


  openPreview = (cob) => {
    this.setState({ selected: cob });
  };

  closePreview = () => {
    this.setState({ selected: null, showRejectDialog: false, rejectReason: "" });
  };

  approve = async (cob) => {
    if (!window.confirm(`Approve ${cob.cobillingNo}?`)) return;
    this.setState({ loading: true });
    try {
      const ref = doc(db, cob.source === 'direct' ? 'invoices' : 'cobilling', cob.id);
      await updateDoc(ref, {
        status: 'Approved',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // update order recvQty if needed (same as before)
      if (cob.customerOrderId) {
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const orderDoc = ordersSnap.docs.find(d => (d.data().orderNo || '') === (cob.customerOrderId || ''));
        if (orderDoc) {
          const orderId = orderDoc.id;
          const orderData = orderDoc.data();
          const updatedLineItems = (orderData.lineItems || []).map(oli => {
            const match = (cob.lineItems || []).find(ci => ci.itemCode === oli.itemCode);
            if (match) {
              const incomingQty = parseFloat(match.qty || 0) || 0;
              const prevRecv = parseFloat(oli.recvQty || 0) || 0;
              oli.recvQty = Math.max(0, (prevRecv + incomingQty));
              oli.remainingQty = Math.max(0, (parseFloat(oli.qty || oli.orderQty || 0) - oli.recvQty));
            }
            return oli;
          });
          let anyRecv = updatedLineItems.some(li => (parseFloat(li.recvQty || 0) > 0));
          let allDone = updatedLineItems.every(li => (parseFloat(li.qty || li.orderQty || 0) <= (parseFloat(li.recvQty || 0))));
          const newOrderStatus = allDone ? 'Completed' : (anyRecv ? 'Partial' : orderData.status || 'Entered');
          await updateDoc(doc(db, 'orders', orderId), {
            lineItems: updatedLineItems,
            status: newOrderStatus,
            updatedAt: serverTimestamp()
          });
        }
      }
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
    const ref = doc(db, selected.source === 'direct' ? 'invoices' : 'cobilling', selected.id);
    await updateDoc(ref, {
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
        <h4 className="card-title">Billing Approval</h4>
        <div className="mb-3">
                <input
    type="text"
    className="form-control"
    placeholder="Search by Bill No, Customer, Status, Date..."
    value={this.state.searchTerm}
    onChange={(e) => this.setState({ searchTerm: e.target.value })}
  />
</div>

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
  {this.state.cobilling
    .filter(c => {
      const term = this.state.searchTerm.toLowerCase();
      if (!term) return true;

      const billNo = (c.source === 'direct' ? (c.invoiceNo || '-') : (c.cobillingNo || '-')).toString().toLowerCase();
      const date = (c.source === 'direct' ? (c.invoiceDate || '-') : (c.cobillingDate || '-')).toString().toLowerCase();
      const value = (c.source === 'direct' ? (c.invoiceValue || c.amount || '-') : (c.billValue || c.amount || '-')).toString().toLowerCase();
      const customer = (c.customer || "-").toLowerCase();
      const status = (c.status || "-").toLowerCase();
      const type = (c.source === 'direct' ? "Direct Billing" : "Customer Billing").toLowerCase();

      return (
        billNo.includes(term) ||
        date.includes(term) ||
        value.includes(term) ||
        customer.includes(term) ||
        status.includes(term) ||
        type.includes(term)
      );
    })
    .map(c => {
      let statusClass = "badge-secondary";
      if (c.status === "Approved") statusClass = "badge-success";
      else if (c.status === "Amended") statusClass = "badge-info";
      else if (c.status === "Cancelled") statusClass = "badge-danger";
      else if (c.status === "Awaiting Approval" || c.status === "Pending") statusClass = "badge-warning";

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
  {this.state.cobilling.length === 0 && (
    <tr>
      <td colSpan="7" className="text-center">No billing found.</td>
    </tr>
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
          <div className="col-md-4"><b>Reject Reason:</b> {c.rejectReason || "-"}</div>
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
        {this.state.selected
          ? this.renderPreview()
          : this.renderTable()}
      </div>
    );
  }
}

export default BillingApproval;