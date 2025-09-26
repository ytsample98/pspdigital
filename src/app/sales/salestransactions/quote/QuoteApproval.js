import React, { Component } from "react";
import { db } from "../../../../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toWords } from "number-to-words";

class QuoteApproval extends Component {
  state = {
    quotes: [],
    customers: [],
    products: [],
    taxGroups: [],
    selectedQuote: null,
    previewMode: false,
    editingId: null,
    showEditForm: false,
    editFormData: null,
    loading: false,
    error: null,
    showRejectDialog: false,
    rejectReason: "",
  };

  componentDidMount() {
    this.fetchQuotes();
    this.fetchCustomers();
    this.fetchProducts();
    this.fetchTaxGroups();
  }

  fetchQuotes = async () => {
    this.setState({ loading: true, error: null });
    try {
      const snap = await getDocs(collection(db, "quotes"));
      const quotes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.setState({ quotes, loading: false });
    } catch (err) {
      this.setState({ error: err.message, loading: false });
    }
  };

  fetchCustomers = async () => {
    const snap = await getDocs(collection(db, "customers"));
    const customers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ customers });
  };

  fetchProducts = async () => {
    const snap = await getDocs(collection(db, "products"));
    const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ products });
  };

  fetchTaxGroups = async () => {
    const snap = await getDocs(collection(db, "taxGroups"));
    const taxGroups = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ taxGroups });
  };

  openPreview = (quote) => {
    this.setState({ selectedQuote: quote, previewMode: true, showEditForm: false });
  };

  closePreview = () => {
    this.setState({ selectedQuote: null, previewMode: false, showEditForm: false, editingId: null });
  };

  openEditForm = (quote) => {
    this.setState({
      showEditForm: true,
      editingId: quote.id,
      editFormData: { ...quote },
      previewMode: false,
    });
  };
closeEditForm = () => {
  this.setState({ showEditForm: false, editingId: null, editFormData: null, previewMode: true });
};
handleEditInputChange = (field, value) => {
  this.setState(prev => ({
    editFormData: { ...prev.editFormData, [field]: value }
  }), () => {
    if (field === "discountPercent") this.recalculateEditTotals();
    if (field === "quoteType") {
      if (value === "Standard") {
        this.setState(prev => ({
          editFormData: {
            ...prev.editFormData,
            quoteNo: `QT${1000 + this.state.quotes.length}`
          }
        }));
      } else {
        this.setState(prev => ({
          editFormData: { ...prev.editFormData, quoteNo: "" }
        }));
      }
    }
  });
};

handleEditLineItemChange = (idx, field, value) => {
  const items = [...this.state.editFormData.lineItems];
  items[idx] = { ...items[idx], [field]: value };
  // Recalculate itemTotal and taxAmt
  let percent = 0;
  let amount = 0;
  (items[idx].taxGroupNames || []).forEach(groupName => {
    const group = this.state.taxGroups.find(t => t.groupName === groupName);
    if (group && Array.isArray(group.lineItems)) {
      group.lineItems.forEach(comp => {
        const val = parseFloat(comp.percentOrAmt || 0);
        if (comp.type === 'Percentage') percent += val;
        if (comp.type === 'Amount') amount += val;
      });
    }
  });
  const qty = parseFloat(items[idx].qty || 0);
  const unitPrice = parseFloat(items[idx].unitPrice || 0);
  const baseTotal = qty * unitPrice;
  const taxAmt = ((baseTotal * percent) / 100 + amount);
  items[idx].taxAmt = taxAmt.toFixed(2);
  items[idx].itemTotal = (baseTotal + taxAmt).toFixed(2);
  items[idx].baseTotal = baseTotal.toFixed(2);

  this.setState(prev => ({
    editFormData: { ...prev.editFormData, lineItems: items }
  }), this.recalculateEditTotals);
};


recalculateEditTotals = () => {
  const { lineItems, discountPercent } = this.state.editFormData;
  let quoteValue = 0;
  let taxAmount = 0;
  (lineItems || []).forEach(item => {
    quoteValue += parseFloat(item.itemTotal || 0);
    taxAmount += parseFloat(item.taxAmt || 0);
  });
  const discountAmount = (parseFloat(quoteValue) * parseFloat(discountPercent || 0)) / 100;
  const afterDiscountValue = quoteValue - discountAmount;
  this.setState(prev => ({
    editFormData: {
      ...prev.editFormData,
      quoteValue: quoteValue.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      afterDiscountValue: afterDiscountValue.toFixed(2)
    }
  }));
};
  handleEditSubmit = async (e) => {
  e.preventDefault();
  const { editingId, editFormData } = this.state;
  if (!editFormData.customer) return alert("Customer is required");
  if (!editFormData.lineItems || editFormData.lineItems.length === 0) return alert("At least one line item is required");
  try {
    await updateDoc(doc(db, "quotes", editingId), editFormData);
    alert("Quote updated!");
    this.setState({ showEditForm: false, editingId: null, editFormData: null, previewMode: true });
    this.fetchQuotes();
  } catch (err) {
    alert("Error updating quote: " + err.message);
  }
};

  updateStatus = async (id, status, rejectReason = "") => {
  await updateDoc(doc(db, "quotes", id), { status, rejectReason });
  alert(`Quote ${status}`);
  this.fetchQuotes();
  this.setState({ selectedQuote: null, previewMode: false, showRejectDialog: false, rejectReason: "" });
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

  handleRejectConfirm = () => {
    const { selectedQuote, rejectReason } = this.state;
    if (!rejectReason.trim()) {
      alert("Please enter a reason for rejection.");
      return;
    }
    this.updateStatus(selectedQuote.id, "Rejected", rejectReason);
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

  renderQuoteTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Quotes Approval</h4>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr style={{ fontSize: '14px' }}>
                <th>Quote ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Quote Value</th>
                <th>After Discount</th>
                <th>Status</th>
                <th>Reject Reason</th>
                <th>Print</th>
              </tr>
            </thead>
            <tbody>
              {this.state.quotes.map((q, i) => {
                let statusClass = "badge-secondary";
                if (q.status === "Awaiting for Approval") statusClass = "badge-warning";

                else if (q.status === "Approved") statusClass = "badge-success";
                else if (q.status === "Rejected") statusClass = "badge-danger";
                else if (q.status === "CO Created") statusClass = "badge-info";

                return (
                  <tr key={i} style={{ fontSize: '14px' }}>
                    <td>
                      <button
                        className="btn btn-link p-0"
                        onClick={() => this.openPreview(q)}
                      >
                        {q.quoteNo}
                      </button>
                    </td>
                    <td>{q.customer}</td>
                    <td>{q.quoteDate}</td>
                    <td>{q.quoteValue}</td>
                    <td>{q.afterDiscountValue}</td>
                    <td>
                      <label
                        className={`badge ${statusClass}`}
                        style={{ fontSize: '14px' }}>{q.status}</label>
                    </td>
                    <td>{q.rejectReason || "-"}</td>
                    <td>
                      <i
                        className="mdi mdi-printer menu-icon"
                        onClick={() => this.showQuotePDFWithOrg(q)}
                        style={{ fontSize: '24px', color: '#2196F3', cursor: 'pointer' }}
                      ></i>
                    </td>
                  </tr>
                );
              })}
              {this.state.quotes.length === 0 && (
                <tr><td colSpan="8" className="text-center">No quotes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
renderEditForm = () => {
  const { editFormData } = this.state;
  if (!editFormData) return null;
  return (
    <div className="card mt-4 p-4 shadow-sm full-height d-flex flex-column">
      <h4>Edit Quote - {editFormData.quoteNo}</h4>
      <form onSubmit={this.handleEditSubmit}>
        <div className="form-row">
          <div className="form-group col-md-3">
            <label>Quote Type</label>
            <select
              className="form-control"
              value={editFormData.quoteType}
              onChange={e => this.handleEditInputChange("quoteType", e.target.value)}
            >
              <option value="Standard">Standard</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
          <div className="form-group col-md-3">
            <label>Quote No</label>
            {editFormData.quoteType === "Standard" ? (
              <input
                type="text"
                className="form-control"
                value={editFormData.quoteNo}
                readOnly
                placeholder="Auto"
              />
            ) : (
              <input
                type="text"
                className="form-control"
                value={editFormData.quoteNo}
                onChange={e => this.handleEditInputChange("quoteNo", e.target.value)}
                placeholder="Enter Quote No"
              />
            )}
            </div>
          <div className="form-group col-md-3">
            <label>Customer</label>
            <input
              type="text"
              className="form-control"
              value={editFormData.customer}
              onChange={e => this.handleEditInputChange("customer", e.target.value)}
            />
          </div>
          <div className="form-group col-md-3">
            <label>Date</label>
            <input
              type="date"
              className="form-control"
              value={editFormData.quoteDate}
              onChange={e => this.handleEditInputChange("quoteDate", e.target.value)}
            />
          </div>
        </div> <div className="form-row">
          <div className="form-group col-md-3">
            <label>Status</label>
            <input
              type="text"
              className="form-control"
              value={editFormData.status}
              readOnly
            />
          </div>
          <div className="form-group col-md-3">
            <label>Discount %</label>
            <input
              type="number"
              className="form-control"
              value={editFormData.discountPercent}
              onChange={e => this.handleEditInputChange("discountPercent", e.target.value)}
            />
          </div>
          <div className="form-group col-md-3">
            <label>Quote Value</label>
            <input
              type="number"
              className="form-control"
              value={editFormData.quoteValue}
              readOnly
            />
          </div>
 <div className="form-group col-md-3">
            <label>Tax Amount</label>
            <input
              type="number"
              className="form-control"
              value={editFormData.taxAmount}
              readOnly
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-3">
            <label>Discount Amount</label>
            <input
              type="number"
              className="form-control"
              value={editFormData.discountAmount}
              readOnly
            />
          </div><div className="form-group col-md-3">
            <label>After Discount</label>
            <input
              type="number"
              className="form-control"
              value={editFormData.discountPercent > 0 ? editFormData.afterDiscountValue : ""}
              readOnly
              placeholder={editFormData.discountPercent > 0 ? "" : "Enter Discount %"}
            />
          </div>
        </div>
        <h5 className="mt-3">Line Items</h5>
        <table className="table table-bordered table-sm">
          <thead className="thead-light">
            <tr>
              <th>Item Code</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Tax Amount</th>
              <th>Item Total</th>
            </tr>
          </thead>
          <tbody> {editFormData.lineItems?.map((item, idx) => (
              <tr key={idx}>
                <td>{item.itemCode}</td>
                <td>{item.itemDescription}</td>
                <td>
                  <input
                    type="number"
                    value={item.qty}
                    onChange={e => this.handleEditLineItemChange(idx, "qty", e.target.value)}
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={e => this.handleEditLineItemChange(idx, "unitPrice", e.target.value)}
                    style={{ width: 80 }}
                  />
                </td>
                <td>{item.taxAmt}</td>
                <td>{item.itemTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
<div className="mt-3 text-right">
          <button type="submit" className="btn btn-success mr-2">Save</button>
          <button type="button" className="btn btn-secondary" onClick={this.closeEditForm}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

  renderQuotePreview = () => {
    const q = this.state.selectedQuote;
    if (!q) return null;

    const subtotal = q.lineItems?.reduce(
      (sum, item) => sum + (parseFloat(item.itemTotal) || 0),
      0
    ) || 0;

    const freightCharges = parseFloat(q.freightCharges || 0);
    const taxAmount = parseFloat(q.taxAmount || 0);
    const grandTotal = parseFloat(q.quoteValue || subtotal + freightCharges + taxAmount);

    const amountWords = `INR ${toWords(Math.floor(grandTotal))} Only`;

    // Find customer record for extra details
    const customer = this.state.customers.find(
      c => c.custshortName === q.customer || c.custname === q.customer
    ) || {};

    return (
      <div className="card mt-4 p-4 shadow-sm full-height d-flex flex-column">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title mb-0">Quote Preview - {q.quoteNo}</h4>
          <div className="flex items-center gap-x-4">
            <button
              className="btn btn-sm btn-primary mr-2"
              onClick={() => this.openEditForm(q)}
              disabled={q.status === "CO Created"}
            >
              Edit
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => this.convertToOrder(q)}
              disabled={q.status !== "Approved"}
            >
              Convert to Order
            </button>
            <i
              className="mdi mdi-printer menu-icon ml-3"
              style={{ marginBlockStart: '10px', gap: '10px', fontSize: '27px', color: '#2196F3', cursor: 'pointer' }}
              onClick={() => this.showQuotePDFWithOrg(q)}
            ></i>
          </div>
        </div>

        {/* Quote Info */}
        <div className="row mb-3">
          <div className="col-md-4"><b>Customer:</b> {q.customer}</div>
          <div className="col-md-4"><b>Date:</b> {q.quoteDate}</div>
          <div className="col-md-4"><b>Status:</b> {q.status}</div>
        </div>

        <div className="row mb-4">
          <div className="col-md-6">
            <b>Bill To:</b><br />
            {q.billTo || "-"}
            <div className="mt-2" style={{ fontSize: "0.9em" }}>
              <b>GSTIN:</b> {customer.gstin || "-"}<br />
              <b>Email:</b> {customer.email || "-"}<br />
              <b>Phone:</b> {customer.phone || "-"}
            </div>
          </div>
          <div className="col-md-6">
            <b>Ship To:</b><br />
            {q.shipTo || "-"}
          </div>
        </div>

        {/* Line Items */}
        <h5 className="mt-2">Line Items</h5>
        <table className="table table-bordered table-sm">
          <thead className="thead-light">
            <tr>
              <th>Item Code</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Tax Amount</th>
              <th>Item Total</th>
            </tr>
          </thead>
          <tbody>
            {q.lineItems?.map((item, i) => (
              <tr key={i}>
                <td>{item.itemCode}</td>
                <td>{item.itemDescription}</td>
                <td>{item.qty}</td>
                <td>{item.unitPrice}</td>
                <td>{item.taxAmt}</td>
                <td>{item.itemTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals as Text */}
        <div className="mt-3">
          <p><b>Subtotal:</b> {subtotal.toFixed(2)}</p>
          <p><b>Freight Charges:</b> {freightCharges.toFixed(2)}</p>
          <p><b>Tax Amount:</b> {taxAmount.toFixed(2)}</p>
          <p className="h6"><b>Grand Total:</b> {grandTotal.toFixed(2)}</p>
          <p className="h6"><b>Amount in Words:</b> {amountWords}</p>
        </div>
        <div className="mt-2">
          <b>Reject Reason:</b> {q.rejectReason || "-"}
        </div>
        <div className="mt-auto pt-3 text-right">
          <button
            className="btn btn-success"
            onClick={() => this.updateStatus(q.id, "Approved")}
            disabled={q.status !== "Awaiting for Approval"}
          >
            Approve
          </button>
          <button
          className="btn btn-danger"
          onClick={this.openRejectDialog}
          disabled={q.status !== "Awaiting for Approval"}
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

  renderEditForm = () => {
    const { editFormData } = this.state;
    if (!editFormData) return null;
    return (
      <div className="card mt-4 p-4 shadow-sm full-height d-flex flex-column">
        <h4>Edit Quote - {editFormData.quoteNo}</h4>
        <form onSubmit={this.handleEditSubmit}>
          <div className="form-row">
            <div className="form-group col-md-3">
              <label>Customer</label>
              <input
                type="text"
                className="form-control"
                value={editFormData.customer}
                onChange={e => this.handleEditInputChange("customer", e.target.value)}
              />
            </div>
            <div className="form-group col-md-3">
              <label>Date</label>
              <input
                type="date"
                className="form-control"
                value={editFormData.quoteDate}
                onChange={e => this.handleEditInputChange("quoteDate", e.target.value)}
              />
            </div>
            <div className="form-group col-md-3">
              <label>Status</label>
              <input
                type="text"
                className="form-control"
                value={editFormData.status}
                readOnly
              />
            </div>
            <div className="form-group col-md-3">
              <label>Discount %</label>
              <input
                type="number"
                className="form-control"
                value={editFormData.discountPercent}
                onChange={e => this.handleEditInputChange("discountPercent", e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group col-md-3">
              <label>Quote Value</label>
              <input
                type="number"
                className="form-control"
                value={editFormData.quoteValue}
                readOnly
              />
            </div>
            <div className="form-group col-md-3">
              <label>Tax Amount</label>
              <input
                type="number"
                className="form-control"
                value={editFormData.taxAmount}
                readOnly
              />
            </div>
            <div className="form-group col-md-3">
              <label>Discount Amount</label>
              <input
                type="number"
                className="form-control"
                value={editFormData.discountAmount}
                readOnly
              />
            </div>
            <div className="form-group col-md-3">
              <label>After Discount</label>
              <input
                type="number"
                className="form-control"
                value={editFormData.afterDiscountValue}
                readOnly
              />
            </div>
          </div>
          <h5 className="mt-3">Line Items</h5>
          <table className="table table-bordered table-sm">
            <thead className="thead-light">
              <tr>
                <th>Item Code</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Tax Amount</th>
                <th>Item Total</th>
              </tr>
            </thead>
            <tbody>
              {editFormData.lineItems?.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.itemCode}</td>
                  <td>{item.itemDescription}</td>
                  <td>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={e => this.handleEditLineItemChange(idx, "qty", e.target.value)}
                      style={{ width: 80 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={e => this.handleEditLineItemChange(idx, "unitPrice", e.target.value)}
                      style={{ width: 80 }}
                    />
                  </td>
                  <td>{item.baseTotal}</td>
                  <td>{item.taxAmt}</td>
                  <td>{item.itemTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-right">
            <button type="submit" className="btn btn-success mr-2">Save</button>
            <button type="button" className="btn btn-secondary" onClick={this.closePreview}>Cancel</button>
          </div>
        </form>
      </div>
    );
  };

 showQuotePDFWithOrg = async (quote) => {
  if (!quote || !Array.isArray(quote.lineItems) || quote.lineItems.length === 0) {
    alert("Quote data is incomplete.");
    return;
  }

  // 1. Fetch org and customer data
  const orgSnap = await getDocs(collection(db, 'businessGroups'));
  const org = orgSnap.docs[0]?.data() || {};
  const customer = this.state.customers.find(
    c => c.custshortName === quote.customer || c.custname === quote.customer
  ) || {};

  // GST State Map for Place of Supply
  const gstStateMap = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "25": "Daman and Diu", "26": "Dadra and Nagar Haveli", "27": "Maharashtra", "28": "Andhra Pradesh (Old)",
    "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
    "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
    "97": "Other Territory"
  };

  // Helper for Place of Supply
  const getPlaceOfSupply = (gstin) => {
    if (!gstin || gstin.length < 2) return '';
    const code = gstin.substring(0, 2);
    const state = gstStateMap[code];
    return state ? `${code} - ${state}` : '';
  };

  // 2. Enrich line items
  const enrichedItems = quote.lineItems.map(item => {
    const product = this.state.products.find(p => p.productId === item.itemCode) || {};
    return {
      ...item,
      ptshortName: product.ptshortName || '',
      hsnCode: product.hsnCode || '',
      uom: product.stockingUOM || '',
      cgst: item.cgst || 0,
      sgst: item.sgst || 0,
      igst: item.igst || 0,
      taxGroupNames: item.taxGroupNames || (item.taxGroupName ? item.taxGroupName.split(',').map(s => s.trim()) : [])
    };
  });

  // 3. Subtotal (without tax)
  const subtotal = enrichedItems.reduce((sum, item) => sum + ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.qty) || 0)), 0);
  const freightCharges = parseFloat(quote.freightCharges || 0);
  const freightTax = parseFloat(quote.freighttaxAmount || 0);
  const totalTaxAmount = parseFloat(quote.taxAmount || 0);
  const grandTotal = parseFloat(quote.quoteValue || (subtotal + totalTaxAmount));
  const amountWords = `INR ${toWords(Math.floor(grandTotal))} Only`;

  // 4. Tax breakdown by group
  let taxBreakdown = {};
  let taxGroupDetails = [];
  let sno = 1;
  enrichedItems.forEach(item => {
    const qty = parseFloat(item.qty || 0);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const base = qty * unitPrice;
    (item.taxGroupNames || []).forEach(tgName => {
      // Find group in taxGroups
      const group = (this.state.taxGroups || []).find(g => g.groupName === tgName);
      if (group) {
        group.lineItems.forEach(li => {
          const key = `${tgName} - ${li.component} (${li.percentOrAmt}${li.type === 'Amount' ? '' : '%'})`;
          let taxAmt = 0;
          if (li.type === 'Amount') taxAmt = parseFloat(li.percentOrAmt || 0);
          else taxAmt = (base * parseFloat(li.percentOrAmt || 0)) / 100;
          taxBreakdown[key] = (taxBreakdown[key] || 0) + taxAmt;
          taxGroupDetails.push({
            sno: sno++,
            group: tgName,
            peramt: `${li.percentOrAmt}${li.type === 'Amount' ? '' : '%'}`,
            taxAmt: taxAmt.toFixed(2)
          });
        });
      }
    });
    // Legacy support for cgst/sgst/igst
    if (item.cgst) {
      const key = `CGST ${item.cgst}%`;
      const taxAmt = (base * item.cgst) / 100;
      taxBreakdown[key] = (taxBreakdown[key] || 0) + taxAmt;
      taxGroupDetails.push({
        sno: sno++,
        group: key,
        peramt: `${item.cgst}%`,
        taxAmt: taxAmt.toFixed(2)
      });
    }
    if (item.sgst) {
      const key = `SGST ${item.sgst}%`;
      const taxAmt = (base * item.sgst) / 100;
      taxBreakdown[key] = (taxBreakdown[key] || 0) + taxAmt;
      taxGroupDetails.push({
        sno: sno++,
        group: key,
        peramt: `${item.sgst}%`,
        taxAmt: taxAmt.toFixed(2)
      });
    }
    if (item.igst) {
      const key = `IGST ${item.igst}%`;
      const taxAmt = (base * item.igst) / 100;
      taxBreakdown[key] = (taxBreakdown[key] || 0) + taxAmt;
      taxGroupDetails.push({
        sno: sno++,
        group: key,
        peramt: `${item.igst}%`,
        taxAmt: taxAmt.toFixed(2)
      });
    }
  });
  if (freightTax > 0) {
    taxBreakdown["Freight Tax"] = freightTax;
    taxGroupDetails.push({
      sno: sno++,
      group: "Freight Tax",
      peramt: "-",
      taxAmt: freightTax.toFixed(2)
    });
  }

  // 5. Milestone breakdown (with subproducts)
  const { breakdownItems, breakdownType } = this.state;

  // 6. Build HTML for PDF
  const container = document.createElement('div');
  container.id = 'pdf-preview-container';
  container.style.width = '794px';
  container.style.padding = '40px';
  container.style.fontFamily = 'Arial';

  // 7. Main PDF content
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <img src="${org.logoUrl || ''}" style="height:50px;" />
      <div style="font-size:18px; font-weight:bold;">QUOTATION</div>
    </div>
    <hr/>
    <div style="display:flex; justify-content:space-between; font-size:11px;">
      <div style="line-height:1.5; width:50%;">
        <b>${org.bgName || ''}</b><br/>
        ${org.address || ''}<br/>
        <b>Email:</b> ${org.email || ''}<br/>
        <b>Website:</b> ${org.website || ''}<br/>
        <b>GSTIN:</b> ${org.gstin || ''}<br/>
        <b>Mobile:</b> ${org.mobile || ''}<br/>
        <b>CIN:</b> ${org.cin || ''}
      </div>
      <table style="font-size:11px; text-align:left;">
        <tr><td><b>Quote No</b></td><td>: ${quote.quoteNo}</td></tr>
        <tr><td><b>Quote Date</b></td><td>: ${quote.quoteDate}</td></tr>
        <tr><td><b>Currency</b></td><td>: ${quote.currency || 'INR'}</td></tr>
        <tr><td><b>Despatch</b></td><td>: ${quote.despatchMode || ''}</td></tr>
      </table>
    </div>

    <div style="margin-top:15px; display:flex; justify-content:space-between; font-size:11px;">
      <div style="width:48%;">
        <b style="background:#011b56; color:#fff; display:block; padding:4px;">Bill To</b>
        <div style="border:1px solid #ccc; padding:6px;">
         <b>${quote.customer || ''}</b><br/>
          ${quote.billTo?.replace(/\n/g, '<br/>') || ''}
        </div>
        <div style="font-size:10px; margin-top:6px;">
            <b>GSTIN:</b> ${customer.gstin || ''}<br/>
            <b>Email:</b> ${customer.email || ''}<br/>
            <b>Contact:</b> ${customer.contactPerson || ''}<br/>
            <b>Phone:</b> ${customer.phone || ''}
        </div>
      </div>
      <div style="width:48%;">
        <b style="background:#011b56; color:#fff; display:block; padding:4px;">Ship To</b>
        <div style="border:1px solid #ccc; padding:6px;">
         <b>${quote.customer || ''}</b><br/>
          ${quote.shipTo?.replace(/\n/g, '<br/>') || ''}
        </div>
        <div style="font-size:10px; margin-top:6px;">
          <b>Place of Supply:</b> ${getPlaceOfSupply(customer.gstin || '')}
        </div>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:10px;">
      <thead>
        <tr style="background:#f4f6fa;">
          <th style="border:1px solid #011b56;">Item Code</th>
          <th style="border:1px solid #011b56;">Description</th>
          <th style="border:1px solid #011b56;">HSN</th>
          <th style="border:1px solid #011b56;">UOM</th>
          <th style="border:1px solid #011b56;">Qty</th>
          <th style="border:1px solid #011b56;">Unit Price</th>
          <th style="border:1px solid #011b56;">GST%</th>
          <th style="border:1px solid #011b56;">Item Total</th>
        </tr>
      </thead>
      <tbody>
        ${enrichedItems.map(item => {
          const gstLabel = (item.taxGroupNames && item.taxGroupNames.length)
            ? item.taxGroupNames.join(', ')
            : (item.taxGroupName || item.taxId || '-');
          return `
            <tr>
              <td style="border:1px solid #011b56;">${item.itemCode}</td>
              <td style="border:1px solid #011b56;">${item.itemDescription}</td>
              <td style="border:1px solid #011b56;">${item.hsnCode}</td>
              <td style="border:1px solid #011b56;">${item.uom}</td>
              <td style="border:1px solid #011b56;">${item.qty}</td>
              <td style="border:1px solid #011b56;">${item.unitPrice}</td>
              <td style="border:1px solid #011b56;">${gstLabel}</td>
              <td style="border:1px solid #011b56;">${item.total}</td>
            </tr>`;
        }).join('')}
        <tr>
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Subtotal</b></td>
          <td style="border:1px solid #011b56;"><b>${subtotal.toFixed(2)}</b></td>
      </tr>
        
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Total Tax Amount</b></td>
          <td style="border:1px solid #011b56;"><b>${totalTaxAmount.toFixed(2)}</b></td>
        </tr>
        <tr>
  <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Discount Amount</b></td>
  <td style="border:1px solid #011b56;"><b>${(quote.discountAmount || 0).toFixed(2)}</b></td>
</tr>

        <tr>
  <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Grand Total</b></td>
  <td style="border:1px solid #011b56;"><b>${(quote.afterDiscountValue || grandTotal).toFixed(2)}</b></td>
</tr>

      </tbody>
    </table>
    <div style="margin-top:8px; font-size:11px;"><b>Amount in Words:</b> ${amountWords}</div>
    <div style="margin-top:20px; text-align:right; font-size:10px;">Printed on ${new Date().toLocaleString()}</div>
  `;

  document.body.appendChild(container);
  const canvas = await html2canvas(container, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'pt', 'a4');
  const width = 595.28;
  const height = canvas.height * width / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, width, height);
  document.body.removeChild(container);

  // ...existing code...

// 8. Milestone breakdown and tax breakdown on the same page, same style as quote table
if (breakdownItems && breakdownItems.length > 0) {
  pdf.addPage();

  let milestoneRows = breakdownItems.filter(bi => bi.selected !== false).map((item, idx) => {
  const mainItem = enrichedItems.find(li => li.itemCode === item.productId);
  const mainItemTotal = mainItem ? (parseFloat(mainItem.total) || 0) : 0;

  return `
    <tr>
      <td style="border:1px solid #011b56;">${item.sno || ''}</td>
      <td style="border:1px solid #011b56;">${item.productId || ''}</td>
      <td style="border:1px solid #011b56;">${item.desc || ''}</td>
      <td style="border:1px solid #011b56;">${item.value ? item.value + (breakdownType === 'Percentage' ? '%' : '₹') : ''}</td>
      <td style="border:1px solid #011b56;">${item.dueDate || ''}</td>
      <td style="border:1px solid #011b56;">${mainItemTotal.toFixed(2)}</td>
    </tr>
    ${(item.subProducts || []).map((sp, spIdx) => {
      const rawVal = parseFloat(sp.value || 0) || 0;
      let spTotal = 0;
      if (breakdownType === 'Percentage') {
        spTotal = mainItemTotal * rawVal / 100;
      } else {
        spTotal = rawVal;
      }
      return `
        <tr style="background: #f9f9f9;">
          <td style="border:1px solid #011b56;"></td>
          <td style="border:1px solid #011b56;">${item.productId}_${spIdx + 1}</td>
          <td style="border:1px solid #011b56;">→ ${sp.name || ''}</td>
          <td style="border:1px solid #011b56;">${sp.value ? (breakdownType === 'Percentage' ? sp.value + '%' : '₹' + sp.value) : ''}</td>
          <td style="border:1px solid #011b56;">${sp.dueDate || ''}</td>
          <td style="border:1px solid #011b56;">${spTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('')}
  `;
}).join('');


  let taxRows = taxGroupDetails.map(row => {
  return `
    <tr>
      <td style="border:1px solid #011b56;">${row.sno}</td>
      <td style="border:1px solid #011b56;">${row.group}</td>
      <td style="border:1px solid #011b56;">${row.peramt}</td>
      <td style="border:1px solid #011b56;">${row.taxAmt}</td>
    </tr>
  `;
}).join('');


  let combinedHtml = `
    <div style="font-family:Arial; padding:40px; width:100%;">
      <h3 style="margin-bottom:10px; font-size:16px;">Milestone Breakdown</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:10px;">
        <thead>
          <tr style="background:#f4f6fa;">
            <th style="border:1px solid #011b56;">S.No</th>
            <th style="border:1px solid #011b56;">Item ID</th>
            <th style="border:1px solid #011b56;">Desc</th>
            <th style="border:1px solid #011b56;">${breakdownType}</th>
            <th style="border:1px solid #011b56;">Due Date</th>
            <th style="border:1px solid #011b56;">Item Total</th>
          </tr>
        </thead>
        <tbody>
          ${milestoneRows}
        </tbody>
      </table>
      <h3 style="margin-bottom:10px; margin-top:30px; font-size:16px;">Tax Breakdown</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:10px;">
        <thead>
          <tr style="background:#f4f6fa;">
            <th style="border:1px solid #011b56;">S.No</th>
            <th style="border:1px solid #011b56;">Tax Group</th>
            <th style="border:1px solid #011b56;">Per/Amt</th>
            <th style="border:1px solid #011b56;">Tax Amt</th>
          </tr>
        </thead>
        <tbody>
          ${taxRows}
          <tr>
            <td colspan="3" style="text-align:right; border:1px solid #011b56;"><b>Total Tax Amount</b></td>
            <td style="border:1px solid #011b56;"><b>${totalTaxAmount.toFixed(2)}</b></td>
          </tr>
          <tr>
  <td style="border:1px solid #011b56;"></td>
  <td style="border:1px solid #011b56;">Discount</td>
  <td style="border:1px solid #011b56;">${quote.discountPercent || 0}%</td>
  <td style="border:1px solid #011b56;">${(quote.discountAmount || 0).toFixed(2)}</td>
</tr>

        </tbody>
      </table>
    </div>
  `;

  const combinedContainer = document.createElement('div');
  combinedContainer.id = 'pdf-preview-container';
  combinedContainer.style.width = '794px';
  combinedContainer.style.padding = '40px';
  combinedContainer.style.fontFamily = 'Arial';
  combinedContainer.style.fontSize = '10px'; // Ensure same font size as first page
  combinedContainer.innerHTML = combinedHtml;
  document.body.appendChild(combinedContainer);

  const combinedCanvas = await html2canvas(combinedContainer, { scale: 2, useCORS: true });
  const combinedImg = combinedCanvas.toDataURL('image/png');
  pdf.addImage(combinedImg, 'PNG', 0, 0, width, combinedCanvas.height * width / combinedCanvas.width);

  document.body.removeChild(combinedContainer);

}

  pdf.setFontSize(11);
  pdf.text(`For ${org.bgName || ''}`, width - 200, 780);
  pdf.text('Authorized Signatory', width - 200, 800);

  // 11. Show PDF
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const newWin = window.open();
  newWin.document.write(`
    <html><head><title>Quote PDF Preview</title></head>
    <body style="margin:0;">
      <iframe width="100%" height="100%" style="border:none;" src="${url}"></iframe>
      <button onclick="document.querySelector('iframe').contentWindow.print()" style="position:fixed;top:10px;right:110px;"></button>
      <a href="${url}" download="Quote_${quote.quoteNo || 'PDF'}.pdf" style="position:fixed;top:10px;right:10px;"></a>
    </body></html>
  `);
  newWin.document.close();
};


  render() {
    return (
      <div className="container-fluid">
        {this.state.showEditForm
        ? this.renderEditForm()
        : this.state.previewMode
          ? this.renderQuotePreview()
          : this.renderQuoteTable()}
      </div>
    );
  }
}

export default QuoteApproval;