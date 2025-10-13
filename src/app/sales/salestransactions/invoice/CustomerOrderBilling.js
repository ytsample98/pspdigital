import React, { Component } from 'react';
import { db } from '../../../../firebase';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toWords } from 'number-to-words';
import { runTransaction,getDoc,query,where } from 'firebase/firestore';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp,onSnapshot } from 'firebase/firestore';


const amount = 12345678;
const amountWords = `INR ${toWords(amount)} Only`;

class CustomerOrderBilling extends Component {
  state = {
    cobilling: [],
    orders: [],
    customers: [],
    taxGroups: [],
    despatchModes: [],
    paymentTerms: [],
    activeTab: 0,
    showForm: false,
    editingId: null,
    showOrderOverlay: false,
    orderOverlaySearch: '',
    showTaxOverlay: false,
    currentTaxIdx: null,
    notes: '',
    searchTerm: '',
    formData: this.getEmptyCOBillingForm()
  };

  getEmptyCOBillingForm() {
    return {
      cobillingType: 'Standard',
      cobillingNo: '',
      cobillingDate: new Date().toISOString().split('T')[0],
      status: 'Entered',
      refNo: '',
      customerOrderId: '',
      customerOrderCompany: '',
      customerOrderDate: '',
      customer: '',
      currency: '',
      conversionRate: '',
      taxAmount: '',
      billValue: '',
      discountPercent: 0,
      discountAmount: 0,
      afterDiscountValue: 0,
      billTo: '',
      shipTo: '',
      lineItems: [],
      despatchMode: '',
      paymentTerms: '',
      freightCharges: '',
      freighttaxAmount: '',
      packingCharges: '',
      notes: ''
    };
  }
   getBilledQtyMap = async (orderNo) => {
  const snap = await getDocs(collection(db, 'cobilling'));
  const approved = snap.docs
    .map(doc => doc.data())
    .filter(inv => inv.customerOrderId === orderNo && inv.status === "Approved");
  // Map: itemCode -> total billed qty
  const billedQtyMap = {};
  approved.forEach(inv => {
    (inv.lineItems || []).forEach(item => {
      const code = item.itemCode;
      const qty = parseFloat(item.qty || 0);
      billedQtyMap[code] = (billedQtyMap[code] || 0) + qty;
    });
  });
  return billedQtyMap;
};
componentDidMount() {
  this.subscribeToCOBilling();
  this.fetchOrders();
  this.fetchCustomers();
  this.fetchTaxGroups();
  this.fetchDespatchModes();
  this.fetchPaymentTerms();
}

componentWillUnmount() {
  if (this._unsubCOB) this._unsubCOB();
}
handleOverlayClose = () => {
  this.setState({
    overlayType: '',
    orderOverlaySearch: '',
    productOverlayVisible: false,
    showOrderOverlay: false,
    currentTaxLineIdx: null,
    selectedProductIds: [],
  });
};
subscribeToCOBilling = () => {
  this._unsubCOB = onSnapshot(collection(db, 'cobilling'), snap => {
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    data.sort((a,b)=>{
      const dateA=new Date(a.cobillingDate || a.createdAt?.toDate?.() || a.createdAt || 0);
      const dateB=new Date(b.cobillingDate || b.createdAt?.toDate?.() || b.createdAt || 0);
      return dateB - dateA;
    });
    this.setState({ cobilling: data.reverse() });
  }, err => {
    console.error('cobilling snapshot error', err);
  });
};

  fetchCOBilling = async () => {
    const snap = await getDocs(collection(db, 'cobilling'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    data.sort((a,b)=>{
      const dateA=new Date(a.cobillingDate || a.createdAt?.toDate?.() || a.createdAt || 0);
      const dateB=new Date(b.cobillingDate || b.createdAt?.toDate?.() || b.createdAt || 0);
      return dateB - dateA;
    });
    this.setState({ cobilling: data.reverse() });
  };

  fetchOrders = async () => {
    const snap = await getDocs(collection(db, 'orders'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ orders: data.reverse() });
  };

  fetchCustomers = async () => {
    const snap = await getDocs(collection(db, 'customers'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ customers: data });
  };

  fetchTaxGroups = async () => {
    const snap = await getDocs(collection(db, 'taxGroups'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ taxGroups: data });
  };

  fetchDespatchModes = async () => {
    const snap = await getDocs(collection(db, 'modes'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ despatchModes: data });
  };

  fetchPaymentTerms = async () => {
    const snap = await getDocs(collection(db, 'paymentTerms'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ paymentTerms: data });
  };

  showOrderOverlay = () => this.setState({ showOrderOverlay: true, orderOverlaySearch: '' });
  hideOrderOverlay = () => this.setState({ showOrderOverlay: false, orderOverlaySearch: '' });

 selectOrderForInvoice = async (order) => {
  const customerObj = this.state.customers.find(
    c => c.custname === order.customer || c.custcode === order.customer
  );
  const billedQtyMap = await this.getBilledQtyMap(order.orderNo);

  this.setState(prev => ({
    formData: {
      ...prev.formData,
      customerOrderId: order.orderNo,
      customerOrderCompany: order.customer,
      customerOrderDate: order.orderDate,
      customer: order.customer,
      customerCode: customerObj ? customerObj.custcode : '',
      refNo: order.orderNo,
      discountPercent: order.discountPercent || 0,
      discountAmount: order.discountAmount || 0,
      afterDiscountValue: order.afterDiscountValue || 0,
      billTo: customerObj ? this.formatAddress(customerObj.billTo) : '',
      shipTo: customerObj ? this.formatAddress(customerObj.shipTo) : '',
      currency: customerObj ? customerObj.currency || '' : '',
      despatchMode: order.despatchMode || '',
      paymentTerms: order.paymentTerms || '',
      freightCharges: order.freightCharges || '',
      freighttaxAmount: order.freighttaxAmount || '',
      packingCharges: order.packingCharges || '',
      lineItems: (order.lineItems || []).map(item => {
        const alreadyBilled = billedQtyMap[item.itemCode] || 0;
        const orderQty = parseFloat(item.qty || item.orderQty || 0);
        const recvQty = Math.max(orderQty - alreadyBilled, 0);
        return {
            itemCode: item.itemCode || '',
            itemDescription: item.itemDescription || '',
            custPartCode: item.custPartCode || '',
            hsnCode: item.hsnCode || '',
            locator: item.locator || '',
            uom: item.uom || '',
            onHand: item.onHand || 0,
            unitPrice: item.unitPrice || 0,
            orderQty: orderQty,
            recvQty: recvQty, // remaining to bill
            qty: '', // user will enter this
            taxGroupNames: item.taxGroupNames || [],
            taxAmt: item.taxAmt || 0,
            total: this.calcItemTotal('', item.unitPrice || 0, item.taxAmt || 0)
          };
        })
      },
      showOrderOverlay: false
    }));
  };

  recalculateDiscounts = () => {
  const { billValue, discountPercent } = this.state.formData;
  const discountAmount = (parseFloat(billValue || 0) * parseFloat(discountPercent || 0)) / 100;
  const afterDiscountValue = parseFloat(billValue || 0) - discountAmount; // add, not subtract
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      discountAmount: discountAmount.toFixed(2),
      afterDiscountValue: afterDiscountValue.toFixed(2)
    }
  }));
};

  formatAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return [
      addr.address,
      [addr.city, addr.state, addr.country].filter(Boolean).join(', '),
      addr.zip
    ].filter(Boolean).join('\n');
  };

  handleInputChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

handleLineItemChange = (idx, field, value) => {
    const updatedItems = [...this.state.formData.lineItems];
    let val = value;
    if (field === 'qty') {
      const maxQty = parseFloat(updatedItems[idx].recvQty || 0);
      val = Math.max(0, Math.min(parseFloat(value || 0), maxQty));
    }
    updatedItems[idx] = { ...updatedItems[idx], [field]: val };
    if (field === 'qty' || field === 'unitPrice') {
      // recalculate taxAmt and total
      const taxAmt = this.calcTaxAmt(updatedItems[idx]);
      updatedItems[idx].taxAmt = taxAmt;
      updatedItems[idx].total = this.calcItemTotal(val, updatedItems[idx].unitPrice, taxAmt);
    }
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        lineItems: updatedItems
      }
    }), this.recalculateBillTotals);
  };
 approveInvoice = async (invoiceId) => {
    const invoiceRef = doc(db, "cobilling", invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    if (!invoiceSnap.exists()) return alert("Invoice not found!");
    const invoice = invoiceSnap.data();
    const orderSnap = await getDocs(
      query(collection(db, "orders"), where("orderNo", "==", invoice.customerOrderId))
    );
    if (orderSnap.empty) return alert("Order not found!");
    const orderDoc = orderSnap.docs[0];
    const orderRef = doc(db, "orders", orderDoc.id);

    await runTransaction(db, async (transaction) => {
      const orderData = (await transaction.get(orderRef)).data();
      const updatedLineItems = (orderData.lineItems || []).map(item => {
        const invItem = (invoice.lineItems || []).find(li => li.itemCode === item.itemCode);
        const billedQty = parseFloat(item.billedQty || 0);
        const addQty = invItem ? parseFloat(invItem.qty || 0) : 0;
        const orderQty = parseFloat(item.qty || item.orderQty || 0);
        const newBilledQty = billedQty + addQty;
        return {
          ...item,
          billedQty: newBilledQty,
          status: newBilledQty >= orderQty ? "Completed" : "Partial"
        };
      });
      const allCompleted = updatedLineItems.every(li => (parseFloat(li.billedQty || 0) >= parseFloat(li.qty || li.orderQty || 0)));
      transaction.update(orderRef, {
        lineItems: updatedLineItems,
        status: allCompleted ? "Completed" : "Partial"
      });
      transaction.update(invoiceRef, { status: "Approved" });
    });
    alert("Invoice approved and order updated!");
    this.fetchCOBilling();
    this.fetchOrders();
  };
  recalculateBillTotals = () => {
  const { lineItems } = this.state.formData;
  let taxAmount = 0;
  let billValue = 0;
  (lineItems || []).forEach(item => {
    taxAmount += parseFloat(item.taxAmt || 0);
    billValue += parseFloat(item.total || 0);
  });
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      taxAmount: taxAmount.toFixed(2),
      billValue: billValue.toFixed(2)
    }
  }), this.recalculateDiscounts);  // <-- add this
};

  calcTaxAmt = (item) => {
    // Calculate tax based on selected tax group, unit price, qty
    let percent = 0;
    let amount = 0;
    (item.taxGroupNames || []).forEach(groupName => {
      const group = this.state.taxGroups.find(t => t.groupName === groupName);
      if (group && Array.isArray(group.lineItems)) {
        group.lineItems.forEach(comp => {
          const val = parseFloat(comp.percentOrAmt || 0);
          if (comp.type === 'Percentage') percent += val;
          if (comp.type === 'Amount') amount += val;
        });
      }
    });
    const baseTotal = (parseFloat(item.unitPrice || 0) * parseFloat(item.qty || 1));
    return ((baseTotal * percent) / 100 + amount).toFixed(2);
  };

  calcItemTotal = (qty, unitPrice, taxAmt) => {
    qty = parseFloat(qty) || 0;
    unitPrice = parseFloat(unitPrice) || 0;
    taxAmt = parseFloat(taxAmt) || 0;
    return ((qty * unitPrice) + taxAmt).toFixed(2);
  };

  showCoBillingPDFWithOrg = async (invoice) => {
  if (!invoice || !Array.isArray(invoice.lineItems) || invoice.lineItems.length === 0) {
    alert("Invoice data is incomplete.");
    return;
  }

  // 1. Fetch org and customer data
  const orgSnap = await getDocs(collection(db, 'businessGroups'));
  const org = orgSnap.docs[0]?.data() || {};
  const customer = this.state.customers.find(
    c => c.custshortName === invoice.customer || c.custname === invoice.customer
  ) || {};

  // GST State Map for Place of Supply
  const gstStateMap = {
    "01": "Jammu & Kashmir","02": "Himachal Pradesh","03": "Punjab","04": "Chandigarh","05": "Uttarakhand",
    "06": "Haryana","07": "Delhi","08": "Rajasthan","09": "Uttar Pradesh","10": "Bihar","11": "Sikkim",
    "12": "Arunachal Pradesh","13": "Nagaland","14": "Manipur","15": "Mizoram","16": "Tripura","17": "Meghalaya",
    "18": "Assam","19": "West Bengal","20": "Jharkhand","21": "Odisha","22": "Chhattisgarh","23": "Madhya Pradesh",
    "24": "Gujarat","25": "Daman and Diu","26": "Dadra and Nagar Haveli","27": "Maharashtra","28": "Andhra Pradesh (Old)",
    "29": "Karnataka","30": "Goa","31": "Lakshadweep","32": "Kerala","33": "Tamil Nadu","34": "Puducherry",
    "35": "Andaman and Nicobar Islands","36": "Telangana","37": "Andhra Pradesh","97": "Other Territory"
  };
  const getPlaceOfSupply = (gstin) => {
    if (!gstin || gstin.length < 2) return '';
    const code = gstin.substring(0, 2);
    const state = gstStateMap[code];
    return state ? `${code} - ${state}` : '';
  };

  // 2. Enrich line items
  const enrichedItems = invoice.lineItems.map(item => ({
  ...item,
  hsnCode: item.hsnCode || '',
  uom: item.uom || '',
  ptshortName: item.ptshortName || '',
  cgst: item.cgst || 0,
  sgst: item.sgst || 0,
  igst: item.igst || 0,
  taxGroupNames: item.taxGroupNames || (item.taxGroupName ? item.taxGroupName.split(',').map(s => s.trim()) : [])
}));


  // 3. Subtotal
  const subtotal = enrichedItems.reduce((sum, item) =>
    sum + ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.qty) || 0)), 0
  );
  const freightCharges = parseFloat(invoice.freightCharges || 0);
  const freightTax = parseFloat(invoice.freighttaxAmount || 0);
  const totalTaxAmount = parseFloat(invoice.taxAmount || 0);
  const grandTotal = parseFloat(invoice.invoiceValue || (subtotal + totalTaxAmount));
  const amountWords = `INR ${toWords(Math.floor(grandTotal))} Only`;

  // 4. Tax breakdown
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
          let taxAmt = li.type === 'Amount'
            ? parseFloat(li.percentOrAmt || 0)
            : (base * parseFloat(li.percentOrAmt || 0)) / 100;
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
    if (item.cgst) {
      const key = `CGST ${item.cgst}%`;
      const taxAmt = (base * item.cgst) / 100;
      taxBreakdown[key] = (taxBreakdown[key] || 0) + taxAmt;
      taxGroupDetails.push({ sno: sno++, group: key, peramt: `${item.cgst}%`, taxAmt: taxAmt.toFixed(2) });
    }
    if (item.sgst) {
      const key = `SGST ${item.sgst}%`;
      const taxAmt = (base * item.sgst) / 100;
      taxBreakdown[key] = (taxBreakdown[key] || 0) + taxAmt;
      taxGroupDetails.push({ sno: sno++, group: key, peramt: `${item.sgst}%`, taxAmt: taxAmt.toFixed(2) });
    }
    if (item.igst) {
      const key = `IGST ${item.igst}%`;
      const taxAmt = (base * item.igst) / 100;
      taxBreakdown[key] = (taxBreakdown[key] || 0) + taxAmt;
      taxGroupDetails.push({ sno: sno++, group: key, peramt: `${item.igst}%`, taxAmt: taxAmt.toFixed(2) });
    }
  });
  if (freightTax > 0) {
    taxBreakdown["Freight Tax"] = freightTax;
    taxGroupDetails.push({ sno: sno++, group: "Freight Tax", peramt: "-", taxAmt: freightTax.toFixed(2) });
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
      <div style="font-size:18px; font-weight:bold;">INVOICE</div>
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
        <tr><td><b>Invoice No</b></td><td>: ${invoice.cobillingNo}</td></tr>
        <tr><td><b>Invoice Date</b></td><td>: ${invoice.cobillingDate}</td></tr>
        <tr><td><b>Currency</b></td><td>: ${invoice.currency || 'INR'}</td></tr>
        <tr><td><b>Cus.Code</b></td><td>: ${invoice.customerCode || ''}</td></tr>
        <tr><td><b>Despatch</b></td><td>: ${invoice.despatchMode || ''}</td></tr>
      </table>
    </div>

    <div style="margin-top:15px; display:flex; justify-content:space-between; font-size:11px;">
      <div style="width:48%;">
        <b style="background:#011b56; color:#fff; display:block; padding:4px;">Bill To</b>
        <div style="border:1px solid #ccc; padding:6px;">
         <b>${invoice.customer || ''}</b><br/>
          ${invoice.billTo?.replace(/\n/g, '<br/>') || ''}
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
         <b>${invoice.customer || ''}</b><br/>
          ${invoice.shipTo?.replace(/\n/g, '<br/>') || ''}
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
          <th style="border:1px solid #011b56;">Order Qty</th>
          <th style="border:1px solid #011b56;">Billed Qty</th>
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
              <td style="border:1px solid #011b56;">${item.orderQty}</td>
              <td style="border:1px solid #011b56;">${item.qty}</td>
              <td style="border:1px solid #011b56;">${item.unitPrice}</td>
              <td style="border:1px solid #011b56;">${gstLabel}</td>
              <td style="border:1px solid #011b56;">${item.total}</td>
            </tr>`;
        }).join('')}
        <tr>
          <td colspan="8" style="text-align:right; border:1px solid #011b56;"><b>Subtotal</b></td>
          <td style="border:1px solid #011b56;"><b>${subtotal.toFixed(2)}</b></td>
        </tr>
        <tr>
          <td colspan="8" style="text-align:right; border:1px solid #011b56;"><b>Total Tax Amount</b></td>
          <td style="border:1px solid #011b56;"><b>${totalTaxAmount.toFixed(2)}</b></td>
        </tr>
        <tr>
          <td colspan="8" style="text-align:right; border:1px solid #011b56;"><b>Grand Total</b></td>
          <td style="border:1px solid #011b56;"><b>${grandTotal.toFixed(2)}</b></td>
        </tr>
        <tr>
  <td colspan="8" style="text-align:right; border:1px solid #011b56;"><b>Discount Amount</b></td>
  <td style="border:1px solid #011b56;"><b>${invoice.discountAmount || '0.00'}</b></td>
</tr>
<tr>
  <td colspan="8" style="text-align:right; border:1px solid #011b56;"><b>After Discount Value</b></td>
  <td style="border:1px solid #011b56;"><b>${invoice.afterDiscountValue || '0.00'}</b></td>
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

  // 6. Tax Breakdown page
  if (taxGroupDetails.length > 0) {
    pdf.addPage();
    let taxRows = taxGroupDetails.map(row => `
      <tr>
        <td style="border:1px solid #011b56;">${row.sno}</td>
        <td style="border:1px solid #011b56;">${row.group}</td>
        <td style="border:1px solid #011b56;">${row.peramt}</td>
        <td style="border:1px solid #011b56;">${row.taxAmt}</td>
      </tr>`).join('');

let taxHtml = `<div style="font-family:Arial; padding:20px; width:100%;">
<h3 style="margin-bottom:10px; font-size:18px;">Tax Breakdown</h3>
<table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:14px;">
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
  </tbody>
</table>
</div>`;

    const taxContainer = document.createElement('div');
    taxContainer.innerHTML = taxHtml;
    document.body.appendChild(taxContainer);

    const taxCanvas = await html2canvas(taxContainer, { scale: 1.5, useCORS: true });    const taxImg = taxCanvas.toDataURL('image/png');
    pdf.addImage(taxImg, 'PNG', 0, 0, width, taxCanvas.height * width / taxCanvas.width);

    document.body.removeChild(taxContainer);
  }

  pdf.setFontSize(11);
  pdf.text(`For ${org.bgName || ''}`, width - 200, 780);
  pdf.text('Authorized Signatory', width - 200, 800);

  // 7. Show PDF
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const newWin = window.open();
  newWin.document.write(`
    <html><head><title>Invoice PDF Preview</title></head>
    <body style="margin:0;">
      <iframe width="100%" height="100%" style="border:none;" src="${url}"></iframe>
    </body></html>
  `);
  newWin.document.close();
};


  toggleTaxGroupSelection = (groupName, lineIdx, isChecked) => {
    const formData = { ...this.state.formData };
    const item = formData.lineItems[lineIdx];
    if (!item.taxGroupNames) item.taxGroupNames = [];
    if (isChecked) {
      if (!item.taxGroupNames.includes(groupName)) {
        item.taxGroupNames.push(groupName);
      }
    } else {
      item.taxGroupNames = item.taxGroupNames.filter(g => g !== groupName);
    }
    // recalculate taxAmt and total
    item.taxAmt = this.calcTaxAmt(item);
    item.total = this.calcItemTotal(item.qty, item.unitPrice, item.taxAmt);
    this.setState({ formData }, this.recalculateBillTotals);
  };

  

  handleTabChange = (idx) => this.setState({ activeTab: idx });

  handleNotesChange = (e) => this.setState({ notes: e.target.value });

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData, cobilling, notes } = this.state;
    if (!formData.customer) return alert("Customer is required");
    if (formData.lineItems.length === 0) return alert("At least one line item is required");

    const saveData = {
      ...formData,
      notes,
      status: "Awaiting Approval",
      createdAt: serverTimestamp()
    };

    if (editingId) {
      await updateDoc(doc(db, "cobilling", editingId), saveData);
    } else {
      if (formData.cobillingType === 'Standard') {
        saveData.cobillingNo = `COB${101 + cobilling.length}`;
      }
      await addDoc(collection(db, "cobilling"), saveData);
    }

    this.setState({
      showForm: false,
      editingId: null,
      formData: this.getEmptyCOBillingForm(),
      notes: ''
    });
    this.fetchCOBilling();
  };

renderOrderOverlay = () => {
  const { orders, orderOverlaySearch = '', currentPage = 1 } = this.state;

  const filtered = orders.filter(o =>
    (o.orderNo || '').toLowerCase().includes(orderOverlaySearch.toLowerCase()) ||
    (o.customer || '').toLowerCase().includes(orderOverlaySearch.toLowerCase())
  );

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  return (
    <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="custom-overlay-title">Select Customer Order</div>
           <i
              className="mdi mdi-close-box-outline"
              style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }}
              onClick={this.handleOverlayClose}
              aria-label="Close"
              type="button"
            ></i>
        </div>
        <input
          type="text"
          className="form-control mb-2"
          placeholder="Search by ID or Company..."
          value={orderOverlaySearch}
          onChange={e => this.setState({ orderOverlaySearch: e.target.value, currentOrderPage: 1 })}
        />

        <div  style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Company</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((o, i) => (
                <tr
                  key={o.id || i}
                  onClick={() => this.selectOrderForInvoice(o)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{o.orderNo}</td>
                  <td>{o.customer}</td>
                  <td>{o.orderDate}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center">No orders found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
<nav aria-label="Product pagination example" style={{ marginTop: 12 }}>
          <ul className="pagination justify-content-end mb-0">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button
                className="page-link"
                aria-label="Previous"
                onClick={() => this.setState({ currentPage: Math.max(currentPage - 1, 1) })}
              >
                <span aria-hidden="true">&laquo;</span>
              </button>
            </li>
            {[...Array(totalPages)].map((_, idx) => (
              <li key={idx} className={`page-item ${currentPage === idx + 1 ? "active" : ""}`}>
                <button
                type='button'
                  className="page-link"
                  onClick={() => this.setState({ currentPage: idx + 1 })}
                >
                  {idx + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button
              type="button"
                className="page-link"
                aria-label="Next"
                onClick={() => this.setState({ currentPage: Math.min(currentPage + 1, totalPages) })}
              >
                <span aria-hidden="true">&raquo;</span>
              </button>
            </li>
          </ul>
        </nav>
      
      </div>
    </div>
  );
};


 renderTaxOverlay = () => {
  const { taxGroups, currentTaxIdx, formData, taxSearch = ''} = this.state;
  if (currentTaxIdx === null) return null;
  const item = formData.lineItems[currentTaxIdx];
  const selected = new Set(item.taxGroupNames || []);

  const filtered = taxGroups.filter(tg =>
    tg.groupName.toLowerCase().includes(taxSearch.toLowerCase())
  );

  return (
    <div className="custom-overlay">
      <div className="custom-overlay-content">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="custom-overlay-title">Select Tax Groups</div>
        <div>
        <button
    type="submit"
    className="btn btn-success btn-sm float-start"
    onClick={() => this.setState({ showTaxOverlay: false, currentTaxIdx: null })}
  >
    Done
  </button>
<i className="mdi mdi-close-box-outline"
              style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }} 
              onClick={this.handleOverlayClose}
              aria-label="Close"
              type="button"
            >
            </i>
            </div>
        <input
          type="text"
          className="form-control mb-2"
          placeholder="Search Tax Group..."
          value={taxSearch}
          onChange={e => this.setState({ taxSearch: e.target.value, currentTaxPage: 1 })}
        />

          <table className="table table-sm table-bordered">
<thead style={{ background: '#f4f6fa' }}>
              <tr>
                <th style={{ width: '5%' }}></th>
                <th style={{ width: '25%' }}>Group</th>
                <th style={{ width: '50%' }}>Components</th>
                <th style={{ width: '20%' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {taxGroups.map(tg => (
                <tr key={tg.groupName}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(tg.groupName)}
                      onChange={e =>
                        this.toggleTaxGroupSelection(tg.groupName, currentTaxIdx, e.target.checked)
                      }
                    />
                  </td>
                  <td>{tg.groupName}</td>
                  <td>{tg.lineItems.map(li => li.component).join(', ')}</td>
                  <td>{tg.lineItems.map(li => li.percentOrAmt).join(', ')}</td>
                </tr>
              ))}
              {taxGroups.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center">No tax groups found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        

      </div>
    </div>
  );
};


  renderTabs = () => {
    const { activeTab } = this.state;
    const tabNames = ['Billing Details', 'Commercial Details', 'Notes'];
    return (
      <ul className="nav nav-tabs mb-3" style={{ fontSize: '16px' }}>
        {tabNames.map((tab, idx) => (
          <li className="nav-item" key={tab}>
            <button
              type="button"
              className={`nav-link${activeTab === idx ? ' active' : ''}`}
              onClick={() => this.handleTabChange(idx)}
              style={{
                background: activeTab === idx ? '#e9ecef' : '#fff',
                border: '1px solid #dee2e6',
                borderBottom: activeTab === idx ? 'none' : undefined,
                fontWeight: activeTab === idx ? 'bold' : 'normal'
              }}
            >
              {tab}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  renderBillingTab = () => {
    const { formData, showOrderOverlay, showTaxOverlay, currentTaxIdx } = this.state;
    return (
      <div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Bill Type</label>
            <select
              className="form-control form-control-sm"
              value={formData.cobillingType}
              onChange={e => this.handleInputChange('cobillingType', e.target.value)}
            >
              <option value="Standard">Standard</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
          <div className="form-group col-md-2">
            <label>Bill No</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={formData.cobillingNo}
              onChange={e => this.handleInputChange('cobillingNo', e.target.value)}
              readOnly={formData.cobillingType === 'Standard'}
              placeholder={formData.cobillingType === 'Standard' ? 'Auto' : 'Enter Bill No'}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Bill Date</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={formData.cobillingDate}
              onChange={e => this.handleInputChange('cobillingDate', e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Status</label>
            <input type="text" className="form-control form-control-sm" value={formData.status} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Ref No</label>
            <input type="text" className="form-control form-control-sm" value={formData.refNo} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Customer Order</label>
            <div className="input-group input-group-sm">
              <input
                type="text"
                className="form-control"
                value={formData.customerOrderId}
                readOnly
                onClick={this.showOrderOverlay}
                style={{ cursor: 'pointer' }}
              />
              <div className="input-group-append">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={this.showOrderOverlay}>Select</button>
              </div>
            </div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Currency</label>
            <input type="text" className="form-control form-control-sm" value={formData.currency} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Conversion Rate</label>
            <input type="text" className="form-control form-control-sm" value={formData.conversionRate} onChange={e => this.handleInputChange('conversionRate', e.target.value)} />
          </div>
          <div className="form-group col-md-2">
            <label>Tax Amount</label>
            <input type="number" className="form-control form-control-sm" value={formData.taxAmount} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Bill Value</label>
            <input type="number" className="form-control form-control-sm" value={formData.billValue} readOnly />
          </div>
        </div>
        <div className="form-row">
        <div className="form-group col-md-2">
          <label>Discount %</label>
          <input type="number" className="form-control form-control-sm"
          value={formData.discountPercent}
          onChange={e => {
            this.handleInputChange('discountPercent', e.target.value);
            this.recalculateDiscounts();
          }}
        />
        </div>
        <div className="form-group col-md-2">
          <label>Discount Amount</label>
          <input type="number" className="form-control form-control-sm"
            value={formData.discountAmount}
            readOnly
          />
        </div>
        <div className="form-group col-md-2">
          <label>After Discount Value</label>
          <input type="number" className="form-control form-control-sm"
            value={formData.discountPercent > 0 ? formData.afterDiscountValue : ""}
            readOnly
          />
        </div>
      </div>
        <div className="table-responsive mt-3" style={{ overflowX: 'auto' }}>
          <table className="table table-bordered" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f9f9f9', zIndex: 2 }}>Item Code</th>
                <th style={{ position: 'sticky', left: 90, width:'100px',background: '#f9f9f9', zIndex: 2 }}>Item Desc</th>
                <th style={{ position: 'sticky', left: 160, background: '#f9f9f9', zIndex: 2 }}>Cust Part Code</th>
                <th>HSN/SAC</th>
                <th>Locator</th>
                <th>UOM</th>
                <th>On Hand</th>
                <th>Unit Price</th>
                <th>Order Qty</th>
                <th>Recv Qty</th>
                <th>Quantity</th>
                <th>Tax Group</th>
                <th>Tax Amt</th>
                <th>Item Total</th>
              </tr>
            </thead>
            <tbody>
              {(formData.lineItems || []).map((item, idx) => (
                <tr key={idx}>
                  <td style={{ position: 'sticky', left: 0, background: '#f9f9f9', zIndex: 1 }}>{item.itemCode}</td>
                  <td style={{ position: 'sticky', left: 90, width:'100px',background: '#f9f9f9', zIndex: 1 }}>{item.itemDescription}</td>
                  <td style={{ position: 'sticky', left: 160, background: '#f9f9f9', zIndex: 1 }}>{item.custPartCode}</td>
                  <td>{item.hsnCode}</td>
                  <td>{item.locator}</td>
                  <td>{item.uom}</td>
                  <td>{item.onHand}</td> 
                  <td>{item.unitPrice}</td>
                  <td>{item.orderQty}</td>
                  <td>{item.recvQty}</td>
                  <td>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={item.qty}
                      min="1"
                      style={{ width: 80 }}
                      onChange={e => this.handleLineItemChange(idx, 'qty', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => this.setState({ showTaxOverlay: true, currentTaxIdx: idx })}
                    >
                      Select Tax
                    </button>
                    <div style={{ fontSize: '10px', marginTop: '4px' }}>
                      {(item.taxGroupNames || []).join(', ') || '-'}
                    </div>
                  </td>
                  <td>{item.taxAmt}</td>
                  <td>{item.total}</td>
                </tr>
              ))}
              {(!formData.lineItems || formData.lineItems.length === 0) && (
                <tr>
                  <td colSpan="14" className="text-center">No items</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {showOrderOverlay && this.renderOrderOverlay()}
        {showTaxOverlay && this.renderTaxOverlay()}
      </div>
    );
  };

  renderCommercialTab = () => {
    const { formData } = this.state;
    return (
      <div>
        <div className="form-row">
          <div className="form-group col-md-4">
            <label>Despatch Mode</label>
            <input type="text" className="form-control form-control-sm" value={formData.despatchMode} onChange={e => this.handleInputChange('despatchMode', e.target.value)} />
          </div>
          <div className="form-group col-md-4">
            <label>Payment Terms</label>
            <input type="text" className="form-control form-control-sm" value={formData.paymentTerms} onChange={e => this.handleInputChange('paymentTerms', e.target.value)} />
          </div>
          <div className="form-group col-md-4">
            <label>Currency</label>
            <input type="text" className="form-control form-control-sm" value={formData.currency} readOnly />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-4">
            <label>Freight Charges</label>
            <input type="number" className="form-control form-control-sm" value={formData.freightCharges} onChange={e => this.handleInputChange('freightCharges', e.target.value)} />
          </div>
          <div className="form-group col-md-4">
            <label>Freight Tax Amount</label>
            <input type="number" className="form-control form-control-sm" value={formData.freighttaxAmount} onChange={e => this.handleInputChange('freighttaxAmount', e.target.value)} />
          </div>
          <div className="form-group col-md-4">
            <label>Packing Charges</label>
            <input type="number" className="form-control form-control-sm" value={formData.packingCharges} onChange={e => this.handleInputChange('packingCharges', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Bill To</label>
            <textarea className="form-control form-control-sm" rows="2" value={formData.billTo} readOnly />
          </div>
          <div className="form-group col-md-6">
            <label>Ship To</label>
            <textarea className="form-control form-control-sm" rows="2" value={formData.shipTo} readOnly />
          </div>
        </div>
      </div>
    );
  };

  renderNotesTab = () => (
    <div>
      <div className="form-group">
        <label>Notes / Remarks</label>
        <textarea className="form-control form-control-sm" rows="4" value={this.state.notes} onChange={this.handleNotesChange} />
      </div>
    </div>
  );

  renderForm = () => {
    const { activeTab } = this.state;
    return (
      <div className="card full-height">
        <form className="form-sample" onSubmit={this.handleSubmit}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <h4 className="mb-3">Customer Order Billing</h4>
            {this.renderTabs()}
            {activeTab === 0 && this.renderBillingTab()}
            {activeTab === 1 && this.renderCommercialTab()}
            {activeTab === 2 && this.renderNotesTab()}
            <div className="fixed-card-footer text-right p-3 border-top bg-white">
              <button type="button" className="btn btn-secondary mr-2" 
              onClick={() => this.setState({ showForm: false, editingId: null, formData: this.getEmptyCOBillingForm(), notes: '' })}>
                Cancel</button>
              <button type="submit" className="btn btn-success">Save Invoice</button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Customer Order Billing</h4>
          <div className="d-flex align-items-center" style={{ gap: '10px', width: '40%' }}>
          <input
              type="text"
              className="form-control"
              placeholder="Search by Bill No, Customer, Status, Date..."
              value={this.state.searchTerm}
              onChange={(e) => this.setState({ searchTerm: e.target.value })}
            />
            <button className="btn btn-primary" onClick={() => this.setState({ showForm: true })}>Create</button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr>
                <th>Bill No</th>
                <th>Customer Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Bill Value</th>
                <th>After Discount</th>
                <th>Status</th>
                <th>Print</th>
              </tr>
            </thead>
<tbody>
  {this.state.cobilling
    .filter((inv) => {
      const term = this.state.searchTerm.toLowerCase();
      if (!term) return true; // no filter if empty

      return (
        (inv.cobillingNo || "").toLowerCase().includes(term) ||
        (inv.customerOrderId || "").toLowerCase().includes(term) ||
        (inv.customer || "").toLowerCase().includes(term) ||
        (inv.cobillingDate || "").toLowerCase().includes(term) ||
        (inv.status || "").toLowerCase().includes(term) ||
        (inv.billValue?.toString() || "").toLowerCase().includes(term) ||
        (inv.afterDiscountValue?.toString() || "").toLowerCase().includes(term)
      );
    }).map((inv, i) => {
    let statusClass = "badge-secondary";
    if (inv.status === "Approved") statusClass = "badge-success";
    else if (inv.status === "Amended") statusClass = "badge-info";
    else if (inv.status === "Cancelled") statusClass = "badge-danger";
    else if (inv.status === "Awaiting Approval" || inv.status === "Pending") statusClass = "badge-warning";
    else if (inv.status === "Partial") statusClass = "badge-secondary"; // ✅ new option

    return (
      <tr key={i}>
        <td>
            <button
              className="btn btn-link p-0"
              style={{ color: "#2196F3", cursor: "pointer" }}
              onClick={() =>
                this.setState({
                  showForm: true,
                  editingId: inv.id,
                  formData: { ...inv }
                })
              }
            >
              {inv.cobillingNo}
            </button>
        </td>
        <td>{inv.customerOrderId}</td>
        <td>{inv.customer}</td>
        <td>{inv.cobillingDate}</td>
        <td>{inv.billValue}</td>
        <td>{inv.afterDiscountValue}</td>
        <td>
          <label
            className={`badge ${statusClass}`}
            style={{ fontSize: "14px" }}
          >
            {inv.status}
          </label>
        </td>
        <td>
          <i
            className="mdi mdi-printer menu-icon"
            onClick={() => this.showCoBillingPDFWithOrg(inv)}
            style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }}
          ></i>
        </td>
        
      </tr>
    );
  })}
  {this.state.cobilling.length === 0 && (
    <tr>
      <td colSpan="8" className="text-center">
        No cobilling found.
      </td>
    </tr>
  )}
</tbody>

          </table>
        </div>
      </div>
    </div>
  );

  render() {
    return (
      <div className="container-fluid">
        {this.state.showForm ? this.renderForm() : this.renderTable()}
      </div>
    );
  }
}

export default CustomerOrderBilling;