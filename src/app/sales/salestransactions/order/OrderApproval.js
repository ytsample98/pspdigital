import React, { Component } from "react";
import { db } from "../../../../firebase";
import { collection, getDocs, updateDoc, doc,getDoc, query, where  } from "firebase/firestore";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toWords } from "number-to-words";

class OrderApproval extends Component {
  state = {
    orders: [],
    customers: [],
    products: [],
    taxGroups: [],
    selectedOrder: null,
    previewMode: false,
    loading: false,
    error: null,
    showRejectDialog: false,
    showEditForm: false,
    editFormData: null,
    rejectReason: "",
  };

  fetchOrders = async () => {
  this.setState({ loading: true, error: null });
  try {
    const snap = await getDocs(collection(db, "orders"));
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    this.setState({ orders, loading: false });
    console.log("Fetched orders ids:", orders.map(o => o.id));
  } catch (err) {
    this.setState({ error: err.message, loading: false });
  }
};


  componentDidMount() {
    this.fetchOrders();
    this.fetchCustomers();
    this.fetchProducts();
    this.fetchTaxGroups();
  }
openEditForm = (order) => {
  this.setState({ showEditForm: true, editFormData: { ...order } });
};

closeEditForm = () => {
  this.setState({ showEditForm: false, editFormData: null });
};

handleEditInputChange = (field, value) => {
  this.setState(prev => ({
    editFormData: { ...prev.editFormData, [field]: value }
  }));
};

handleEditLineItemChange = (idx, field, value) => {
  const items = [...this.state.editFormData.lineItems];
  items[idx] = { ...items[idx], [field]: value };
  this.setState(prev => ({
    editFormData: { ...prev.editFormData, lineItems: items }
  }), this.recalculateEditTotals);
};
recalculateEditTotals = () => {
  const { lineItems, discountPercent } = this.state.editFormData;
  let orderValue = 0;
  let taxAmount = 0;
  (lineItems || []).forEach(item => {
    const qty = parseFloat(item.qty || 0);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const baseTotal = qty * unitPrice;
    const taxAmt = parseFloat(item.taxAmt || 0);
    orderValue += baseTotal + taxAmt;
    taxAmount += taxAmt;

  });
  const discountAmount = (orderValue * parseFloat(discountPercent || 0)) / 100;
  const afterDiscountValue = orderValue - discountAmount;
  this.setState(prev => ({
    editFormData: {
      ...prev.editFormData,
      orderValue: orderValue.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      afterDiscountValue: afterDiscountValue.toFixed(2)
    }
  }));
};

handleEditSubmit = async (e) => {
  e.preventDefault();
  const { editFormData } = this.state;
  if (!editFormData) return alert("No data to save");
  if (!editFormData.customer) return alert("Customer is required");
  if (!editFormData.lineItems || editFormData.lineItems.length === 0) return alert("At least one line item is required");
  if (!editFormData.id) return alert("Order ID missing – cannot update!");

  try {
    const ref = doc(db, "orders", editFormData.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return alert(`Order not found: ${editFormData.id}`);
    }

    await updateDoc(ref, editFormData);
    alert("Order updated!");
    this.setState({ showEditForm: false, editFormData: null });
    this.fetchOrders();
  } catch (err) {
    console.error("handleEditSubmit error:", err);
    alert("Error updating order: " + err.message);
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

 openPreview = (order) => {
  console.log("openPreview order:", order);
  this.setState({ selectedOrder: order, previewMode: true });
};

// and/or in the Approve button:



  closePreview = () => {
    this.setState({ selectedOrder: null, previewMode: false });
  };

updateStatus = async (id, status, rejectReason = "") => {
  console.log("updateStatus called:", { id, status, rejectReason });
  if (!id) return alert("Missing order id — cannot update");

  this.setState({ loading: true, error: null });
  try {
    const ref = doc(db, "orders", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const q = query(collection(db, "orders"), where("orderNo", "==", id));
      const found = await getDocs(q);
      if (!found.empty) {
        const realId = found.docs[0].id;
        console.log("Found by orderNo, using id:", realId);
        await updateDoc(doc(db, "orders", realId), { status, rejectReason });
      } else {
        this.setState({ loading: false });
        return alert(`No order found with id or orderNo "${id}".`);
      }
    } else {
      await updateDoc(ref, { status, rejectReason });
    }

    alert(`Order ${status}`);
    await this.fetchOrders();
    this.setState({ selectedOrder: null, previewMode: false, showRejectDialog: false, rejectReason: "", loading: false });
  } catch (err) {
    console.error("updateStatus error:", err);
    this.setState({ error: err.message, loading: false });
    alert("Error updating status: " + err.message);
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

  handleRejectConfirm = () => {
    const { selectedOrder, rejectReason } = this.state;
    if (!rejectReason.trim()) {
      alert("Please enter a reason for rejection.");
      return;
    }
    this.updateStatus(selectedOrder.id, "Rejected", rejectReason);
  };

  showOrderPDFWithOrg = async (order) => {
    if (!order || !Array.isArray(order.lineItems) || order.lineItems.length === 0) {
      alert("Order data is incomplete.");
      return;
    }

    // 1. Fetch org and customer data
    const orgSnap = await getDocs(collection(db, 'businessGroups'));
    const org = orgSnap.docs[0]?.data() || {};
    const customer = this.state.customers.find(
      c => c.custshortName === order.customer || c.custname === order.customer
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

    const getPlaceOfSupply = (gstin) => {
      if (!gstin || gstin.length < 2) return '';
      const code = gstin.substring(0, 2);
      const state = gstStateMap[code];
      return state ? `${code} - ${state}` : '';
    };

    // 2. Enrich line items
    const enrichedItems = order.lineItems.map(item => {
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
    const freightCharges = parseFloat(order.freightCharges || 0);
    const freightTax = parseFloat(order.freighttaxAmount || 0);
    const totalTaxAmount = parseFloat(order.taxAmount || 0);
    const grandTotal = parseFloat(order.orderValue || (subtotal + totalTaxAmount));
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

    // 5. Build HTML for PDF
    const container = document.createElement('div');
    container.id = 'pdf-preview-container';
    container.style.width = '794px';
    container.style.padding = '40px';
    container.style.fontFamily = 'Arial';

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <img src="${org.logoUrl || ''}" style="height:50px;" />
        <div style="font-size:18px; font-weight:bold;">CUSTOMER ORDER</div>
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
          <tr><td><b>Order No</b></td><td>: ${order.orderNo}</td></tr>
          <tr><td><b>Order Date</b></td><td>: ${order.orderDate}</td></tr>
          <tr><td><b>Currency</b></td><td>: ${order.currency || 'INR'}</td></tr>
          <tr><td><b>Despatch</b></td><td>: ${order.despatchMode || ''}</td></tr>
        </table>
      </div>

      <div style="margin-top:15px; display:flex; justify-content:space-between; font-size:11px;">
        <div style="width:48%;">
          <b style="background:#011b56; color:#fff; display:block; padding:4px;">Bill To</b>
          <div style="border:1px solid #ccc; padding:6px;">
           <b>${order.customer || ''}</b><br/>
            ${order.billTo?.replace(/\n/g, '<br/>') || ''}
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
           <b>${order.customer || ''}</b><br/>
            ${order.shipTo?.replace(/\n/g, '<br/>') || ''}
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
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Grand Total</b></td>
          <td style="border:1px solid #011b56;"><b>${grandTotal.toFixed(2)}</b></td>
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

    pdf.setFontSize(11);
    pdf.text(`For ${org.bgName || ''}`, width - 200, 780);
    pdf.text('Authorized Signatory', width - 200, 800);

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const newWin = window.open();
    newWin.document.write(`
      <html><head><title>Order PDF Preview</title></head>
      <body style="margin:0;">
        <iframe width="100%" height="100%" style="border:none;" src="${url}"></iframe>
      </body></html>
    `);
    newWin.document.close();
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

renderOrderTable = () => {
  // Apply sorting here
  const sortedOrders = [...this.state.orders].sort((a, b) => {
    // Approved at bottom, new at top
    if (a.status === "Approved" && b.status !== "Approved") return 1;
    if (b.status === "Approved" && a.status !== "Approved") return -1;

    // Newest first by created date or orderNo
    const aDate = new Date(a.createdAt || a.orderDate || 0);
    const bDate = new Date(b.createdAt || b.orderDate || 0);
    return bDate - aDate; // latest first
  });

  return (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Order Approval</h4>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr style={{ fontSize: '14px' }}>
                <th>Order No</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Order Value</th>
                <th>Status</th>
                <th>Reject Reason</th>
                <th>Print</th>
              </tr>
            </thead>
            <tbody>
              {this.state.orders.map((o, i) => {
                let statusClass = "badge-secondary";
                if (o.status === "Entered") statusClass = "badge-warning";
                else if (o.status === "Approved") statusClass = "badge-success";
                else if (o.status === "Rejected") statusClass = "badge-danger";
                else if (o.status === "CO Created") statusClass = "badge-info";
                else if (o.status === "Awaiting for Approval") statusClass = "badge-warning";

                return (
                  <tr key={i} style={{ fontSize: '14px' }}>
                    <td>
                      <button
                        className="btn btn-link p-0"
                        onClick={() => this.openPreview(o)}
                      >
                        {o.orderNo}
                      </button>
                    </td>
                    <td>{o.customer}</td>
                    <td>{o.orderDate}</td>
                    <td>{o.orderValue}</td>
                    <td>
                      <label
                        className={`badge ${statusClass}`}
                        style={{ fontSize: '14px' }}>{o.status}</label>
                    </td>
                    <td>{o.rejectReason || "-"}</td>
                    <td>
                      <i
                        className="mdi mdi-printer menu-icon"
                        onClick={() => this.showOrderPDFWithOrg(o)}
                        style={{ fontSize: '24px', color: '#2196F3', cursor: 'pointer' }}
                      ></i>
                    </td>
                  </tr>
                );
              })}
              {this.state.orders.length === 0 && (
                <tr><td colSpan="7" className="text-center">No orders found.</td></tr>
              )}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

  renderOrderPreview = () => {
    const o = this.state.selectedOrder;
    if (!o) return null;

    const subtotal = o.lineItems?.reduce(
      (sum, item) => sum + (parseFloat(item.itemTotal) || 0),
      0
    ) || 0;

    const freightCharges = parseFloat(o.freightCharges || 0);
    const taxAmount = parseFloat(o.taxAmount || 0);
    const grandTotal = parseFloat(o.orderValue || subtotal + freightCharges + taxAmount);

    const amountWords = `INR ${toWords(Math.floor(grandTotal))} Only`;

    // Find customer record for extra details
    const customer = this.state.customers.find(
      c => c.custshortName === o.customer || c.custname === o.customer
    ) || {};

    return (
      <div className="card mt-4 p-4 shadow-sm full-height d-flex flex-column">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title mb-0">Order Preview - {o.orderNo}</h4>
          <div className="flex items-center gap-x-4">
            <button
                className="btn btn-sm btn-primary mr-2"
                onClick={() => this.openEditForm(o)}
                disabled={o.status !== "Entered" && o.status !== "Awaiting for Approval"}
              >
                Edit
              </button>
            <i
              className="mdi mdi-printer menu-icon ml-3"
              style={{ marginBlockStart: '10px', gap: '10px', fontSize: '27px', color: '#2196F3', cursor: 'pointer' }}
              onClick={() => this.showOrderPDFWithOrg(o)}
            ></i>
          </div>
        </div>
        <div className="row mb-3">
          <div className="col-md-4"><b>Customer:</b> {o.customer}</div>
          <div className="col-md-4"><b>Date:</b> {o.orderDate}</div>
          <div className="col-md-4"><b>Status:</b> {o.status}</div>
        </div>
        <div className="row mb-4">
          <div className="col-md-6">
            <b>Bill To:</b><br />
            {o.billTo || "-"}
            <div className="mt-2" style={{ fontSize: "0.9em" }}>
              <b>GSTIN:</b> {customer.gstin || "-"}<br />
              <b>Email:</b> {customer.email || "-"}<br />
              <b>Phone:</b> {customer.phone || "-"}
            </div>
          </div>
          <div className="col-md-6">
            <b>Ship To:</b><br />
            {o.shipTo || "-"}
          </div>
        </div>
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
            {o.lineItems?.map((item, i) => (
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
        <div className="mt-3">
          <p><b>Subtotal:</b> {subtotal.toFixed(2)}</p>
          <p><b>Freight Charges:</b> {freightCharges.toFixed(2)}</p>
          <p><b>Tax Amount:</b> {taxAmount.toFixed(2)}</p>
          <p className="h6"><b>Grand Total:</b> {grandTotal.toFixed(2)}</p>
          <p className="h6"><b>Amount in Words:</b> {amountWords}</p>
        </div>
        <div className="mt-2">
          <b>Reject Reason:</b> {o.rejectReason || "-"}
        </div>
        <div className="mt-auto pt-3 text-right">
          <button
            className="btn btn-success"
            onClick={() => {
            console.log("Approve clicked for order:", o);
            this.updateStatus(o.id, "Approved");
          }}
            disabled={o.status !== "Awaiting for Approval"}
          >
            Approve
          </button>
          <button
            className="btn btn-danger"
            onClick={this.openRejectDialog}
            disabled={o.status !== "Awaiting for Approval"}
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
        {this.state.showEditForm
        ? this.renderEditForm()
        : this.state.previewMode
          ? this.renderOrderPreview()
          : this.renderOrderTable()}
      </div>
    );
  }
}

export default OrderApproval;