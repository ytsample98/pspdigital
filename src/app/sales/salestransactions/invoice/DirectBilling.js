import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import bsCustomFileInput from 'bs-custom-file-input';
import { db } from '../../../../firebase';
import { collection, getDocs, addDoc, doc, updateDoc ,serverTimestamp,onSnapshot} from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf'; 
import { toWords } from 'number-to-words';

import { withRouter } from 'react-router-dom';
import { recalculateTotals, getTaxDetailsFromGroup } from '../calculation';

const numberToWords = (num) => {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';
  if (num < 20) return a[num];
  if (num < 100) return b[Math.floor(num / 10)] + ' ' + a[num % 10];
  if (num < 1000)
    return a[Math.floor(num / 100)] + ' Hundred ' + numberToWords(num % 100);
  if (num < 100000)
    return numberToWords(Math.floor(num / 1000)) + ' Thousand ' + numberToWords(num % 1000);
  return 'Amount too large';
};

class DirectBilling extends Component {
  state = {
    activeTab: 'co',
    invoices: [],
    customers: [],
    products: [],
    despatchModes: [],
    paymentTerms: [],

    showForm: false,
    editingId: null,
    
    showTaxOverlay: false,
    currentTaxIdx: null,
    
    overlayType: '',
    overlaySearch: '',
    productOverlayVisible: false,
    productOverlaySearch: '',
    selectedProductIds: [],
    taxGroups: [],
    formData: {
      invoiceNo: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      invoiceType: 'Standard',
      customer: '',
      status: 'Entered', 
      choose: 'Service',
      qrefNo: '',
      impExp: 'None',
      currency: '',
      conversionRate: '',
      taxAmount: '',
      invoiceValue: '',
      discountPercent: 0,
      discountAmount: 0,
      afterDiscountValue: 0,
      billTo: '',
      shipTo: '',
      despatchMode: 'By Air',
      paymentTerms: '',
      freightCharges: '',
      freighttaxAmount: '',
      taxPercent: '',
      packingCharges: '',
      lineItems: [],
    }
  };
  customerInputRef = React.createRef();

  // Helper to format address for Bill To / Ship To
  formatAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return [
      addr.address,
      [addr.city, addr.state, addr.country].filter(Boolean).join(', '),
      addr.zip
    ].filter(Boolean).join('\n');
  };

  showDirectBillingPDFWithOrg = async (invoice) => {
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

  // GST State Map
  const gstStateMap = { "01": "Jammu & Kashmir","02": "Himachal Pradesh","03": "Punjab","04": "Chandigarh","05": "Uttarakhand",
    "06": "Haryana","07": "Delhi","08": "Rajasthan","09": "Uttar Pradesh","10": "Bihar","11": "Sikkim","12": "Arunachal Pradesh",
    "13": "Nagaland","14": "Manipur","15": "Mizoram","16": "Tripura","17": "Meghalaya","18": "Assam","19": "West Bengal",
    "20": "Jharkhand","21": "Odisha","22": "Chhattisgarh","23": "Madhya Pradesh","24": "Gujarat","25": "Daman and Diu",
    "26": "Dadra and Nagar Haveli","27": "Maharashtra","28": "Andhra Pradesh (Old)","29": "Karnataka","30": "Goa","31": "Lakshadweep",
    "32": "Kerala","33": "Tamil Nadu","34": "Puducherry","35": "Andaman and Nicobar Islands","36": "Telangana","37": "Andhra Pradesh",
    "97": "Other Territory" };
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
    taxGroupNames: item.taxGroupNames || (item.taxGroupName ? item.taxGroupName.split(',').map(s => s.trim()) : [])
  }));

  // 3. Totals
  const subtotal = enrichedItems.reduce((sum, item) =>
    sum + ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.qty) || 0)), 0
  );
  const freightCharges = parseFloat(invoice.freightCharges || 0);
  const packingCharges = parseFloat(invoice.packingCharges || 0);
  const freightTax = parseFloat(invoice.freighttaxAmount || 0);
  const totalTaxAmount = parseFloat(invoice.taxAmount || 0);
  const discountAmount = invoice.discountAmount ? parseFloat(invoice.discountAmount) : 0;
  const afterDiscountValue = invoice.afterDiscountValue ? parseFloat(invoice.afterDiscountValue) : null;
  const invoiceValue = parseFloat(invoice.invoiceValue || (subtotal + totalTaxAmount + freightCharges + packingCharges));
  const grandTotal = afterDiscountValue !== null ? afterDiscountValue : invoiceValue;
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
      <div style="font-size:18px; font-weight:bold;">DIRECT BILLING INVOICE</div>
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
        <tr><td><b>Invoice No</b></td><td>: ${invoice.invoiceNo || ''}</td></tr>
        <tr><td><b>Invoice Date</b></td><td>: ${invoice.invoiceDate || ''}</td></tr>
        <tr><td><b>Customer Code</b></td><td>: ${customer.custcode || ''}</td></tr>
        <tr><td><b>Currency</b></td><td>: ${invoice.currency || 'INR'}</td></tr>
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
          <th style="border:1px solid #011b56;">Qty</th>
          <th style="border:1px solid #011b56;">Unit Price</th>
          <th style="border:1px solid #011b56;">GST Group</th>
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
              <td style="border:1px solid #011b56;">${item.itemCode || ''}</td>
              <td style="border:1px solid #011b56;">${item.itemDescription || ''}</td>
              <td style="border:1px solid #011b56;">${item.hsnCode}</td>
              <td style="border:1px solid #011b56;">${item.uom}</td>
              <td style="border:1px solid #011b56;">${item.qty}</td>
              <td style="border:1px solid #011b56;">${item.unitPrice}</td>
              <td style="border:1px solid #011b56;">${gstLabel}</td>
              <td style="border:1px solid #011b56;">${item.itemTotal}</td>
            </tr>`;
        }).join('')}
        <tr>
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Subtotal</b></td>
          <td style="border:1px solid #011b56;"><b>${subtotal.toFixed(2)}</b></td>
        </tr>
        
        <tr>
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Total Tax Amount</b></td>
          <td style="border:1px solid #011b56;"><b>${totalTaxAmount.toFixed(2)}</b></td>
        </tr>
        <tr>
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Invoice Value</b></td>
          <td style="border:1px solid #011b56;"><b>${invoiceValue.toFixed(2)}</b></td>
        </tr>
        <tr>
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>After Discount Value</b></td>
          <td style="border:1px solid #011b56;"><b>${invoice.afterDiscountValue || ''}</b></td>
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

    const taxCanvas = await html2canvas(taxContainer, { scale: 1.5, useCORS: true });
    const taxImg = taxCanvas.toDataURL('image/png');
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
    <html><head><title>Direct Billing PDF Preview</title></head>
    <body style="margin:0;">
      <iframe width="100%" height="100%" style="border:none;" src="${url}"></iframe>
    </body></html>
  `);
  newWin.document.close();
};

  getTaxDetailsFromGroup(groupName) {
  if (!groupName || groupName === 'nill' || groupName === 'more') return { totalPercent: 0, totalAmount: 0 };

  const group = this.state.taxGroups.find(tg => tg.groupName === groupName);
  if (!group || !Array.isArray(group.lineItems)) return { totalPercent: 0, totalAmount: 0 };

  let totalPercent = 0;
  let totalAmount = 0;

  group.lineItems.forEach(item => {
    if (item.type === 'Percentage') {
      totalPercent += parseFloat(item.percentOrAmt || 0);
    } else if (item.type === 'Amount') {
      totalAmount += parseFloat(item.percentOrAmt || 0);
    }
  });

  return { totalPercent, totalAmount };
}

calculateinvoiceTotals = () => {
  const { impExp, freightCharges, taxPercent, packingCharges, lineItems } = this.state.formData;
  let freight = parseFloat(freightCharges) || 0;
  let packing = parseFloat(packingCharges) || 0;
  let taxOnFreight = 0;
  if (['None', 'CIF'].includes(impExp)) {
    taxOnFreight = (freight * (parseFloat(taxPercent) || 0)) / 100;
  }

  let lineTotal = 0;
  let itemTaxTotal = 0;

  const updatedLineItems = lineItems.map(item => {
  const qty = parseFloat(item.qty || 1);
  const unitPrice = parseFloat(item.unitPrice || 0);
  const baseTotal = unitPrice * qty;

  const groupNames = item.taxGroupNames?.length ? item.taxGroupNames : [item.taxGroup || ''];

  let percent = 0;
  let amount = 0;
  groupNames.forEach(groupName => {
    const group = this.state.taxGroups.find(t => t.groupName === groupName);
    if (group && Array.isArray(group.lineItems)) {
      group.lineItems.forEach(comp => {
        const val = parseFloat(comp.percentOrAmt || 0);
        if (comp.type === 'Percentage') percent += val;
        if (comp.type === 'Amount') amount += val;
      });
    }
  });

  const taxAmt = (baseTotal * percent) / 100 + amount;
  const total = baseTotal;

  item.taxAmt = taxAmt.toFixed(2);
  item.total = total.toFixed(2);

  lineTotal += baseTotal;
  itemTaxTotal += taxAmt;

  return item;
});



  const totalTaxAmount = itemTaxTotal + taxOnFreight;
  const invoiceValue = lineTotal + freight + packing + itemTaxTotal;

  this.setState(prev => ({
    formData: {
      ...prev.formData,
      taxAmount: totalTaxAmount.toFixed(2),  // ✅ Top-level field
      invoiceValue: invoiceValue.toFixed(2),
      lineItems: updatedLineItems
    }
  }));
};
handleDiscountChange = (field, value) => {
  let { formData } = this.state;
  formData[field] = value;

  const quoteValue = parseFloat(formData.quoteValue || 0);
  const discountPercent = parseFloat(formData.discountPercent || 0);
  const discountAmount = (quoteValue * discountPercent) / 100;
  const afterDiscountValue = quoteValue - discountAmount;

  formData.discountAmount = discountAmount;
  formData.afterDiscountValue = afterDiscountValue;

  this.setState({ formData });
};


handleChooseChange = (value) => {
  this.setState(prev => ({
    formData: { ...prev.formData, choose: value }
  }), this.filterProductsByCategory);
};

// Filtering logic
filterProductsByCategory = () => {
  const { choose } = this.state.formData;
  let filteredProducts = [];
  if (choose === "Service") {
    filteredProducts = this.state.products.filter(p => p.category === "Service");
  } else if (choose === "Product") {
    filteredProducts = this.state.products.filter(p => p.category === "Product");
  } else if (choose === "Bundle") {
    filteredProducts = this.state.products; // All products
  }
  this.setState({ filteredProducts });
};

componentDidMount() {
  bsCustomFileInput.init();
  this.subscribeToInvoices();
  this.fetchCustomers();
  this.fetchProducts().then(() => this.filterProductsByCategory());
  this.fetchDespatchModes();
  this.fetchPaymentTerms();
  this.fetchTaxGroups();
}

componentWillUnmount() {
  if (this._unsubInvoices) this._unsubInvoices();
}

subscribeToInvoices = () => {
  this._unsubInvoices = onSnapshot(collection(db, 'invoices'), snap => {
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ invoices: data.reverse() });
  }, err => {
    console.error('invoices snapshot error', err);
  });
};
componentDidUpdate(prevProps, prevState) {
  // Customer details auto-fill (keep this)
  if (
    this.state.showForm &&
    this.state.customers.length > 0 &&
    this.state.formData.customer &&
    (prevState.formData.customer !== this.state.formData.customer ||
     (!this.state.formData.billTo && !this.state.formData.shipTo))
  ) {
    const customerObj = this.state.customers.find(
      c => c.custname === this.state.formData.customer || c.custcode === this.state.formData.customer
    );
    if (customerObj) {
      this.setState(prev => ({
        formData: {
          ...prev.formData,
          billTo: this.formatAddress(customerObj.billTo),
          shipTo: this.formatAddress(customerObj.shipTo),
          currency: customerObj.currency || '',
        }
      }));
    }
  }
}

fetchTaxGroups = async () => {
  const snap = await getDocs(collection(db, 'taxGroups'));
  const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  this.setState({ taxGroups: data });
};

  fetchinvoice = async () => {
  const snap = await getDocs(collection(db, 'invoices')); // <-- Correct collection name
  const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  this.setState({ invoices: data.reverse() });
};

  fetchCustomers = async () => {
    const snap = await getDocs(collection(db, 'customers'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ customers: data });
  };

 fetchProducts = async () => {
  const snap = await getDocs(collection(db, 'products'));
  const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  this.setState({ products: data, filteredProducts: data }, this.filterProductsByCategory);
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


  handleInputChange = (field, value) => {
  this.setState(prev => {
    const newForm = { ...prev.formData, [field]: value };

    // When switching to FOB clear freight-related fields
    if (field === 'impExp' && value === 'FOB') {
      newForm.freightCharges = '';
      newForm.taxPercent = '';
      newForm.freighttaxAmount = '';
      newForm.taxAmount = '';
      newForm.packingCharges = '';
      newForm.invoiceValue = '';
    }

    return { formData: newForm };
  }, () => {
    // Recalculate whenever fields that affect totals are changed
    if (['freightCharges', 'packingCharges', 'taxPercent', 'impExp', 'discountPercent'].includes(field)) {
      this.recalculateDirectBillingTotals();
    }
  });
};

handleLineItemChange = (idx, field, value) => {
  const updatedItems = [...this.state.formData.lineItems];
  updatedItems[idx] = { ...updatedItems[idx], [field]: value };

  const qty = parseFloat(updatedItems[idx].qty || 0);
  const unitPrice = parseFloat(updatedItems[idx].unitPrice || 0);

  // compute tax & item total numerically
  const taxAmtNum = this.calcTaxAmt(updatedItems[idx]);
  updatedItems[idx].taxAmt = taxAmtNum; // numeric here; will be formatted in recalc
  updatedItems[idx].itemTotal = this.calcItemTotal(qty, unitPrice, taxAmtNum);

  this.setState(prev => ({
    formData: {
      ...prev.formData,
      lineItems: updatedItems
    }
  }), this.recalculateDirectBillingTotals);
};

handleSubmit = async (e) => {
  e.preventDefault();
  const { editingId, formData, invoices } = this.state;
  if (!formData.customer) return alert("Customer is required");
  if (formData.lineItems.length === 0) return alert("At least one line item is required");

  if (editingId) {
    const { id, ...formDataWithoutId } = formData;
    await updateDoc(doc(db, "invoices", editingId), {
      ...formDataWithoutId,
      status: "Awaiting Approval",
      updatedAt: serverTimestamp()
    });
  } else {
    formData.invoiceNo = `INV${1000 + invoices.length}`;
    await addDoc(collection(db, "invoices"), {
      ...formData,
      status: "Awaiting Approval",
      createdAt: serverTimestamp()
    });
  }

  this.setState({ showForm: false, editingId: null, formData: this.getEmptyInvoiceForm() });
  this.fetchinvoice();
};
// Helper to reset formData
getEmptyInvoiceForm = () => ({
  invoiceNo: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  invoiceType: 'Standard',
  customer: '',
  status: 'Entered',
  choose: 'Service',
  qrefNo: '',
  impExp: 'None',
  currency: '',
  conversionRate: '',
  taxAmount: '',
  invoiceValue: '',
  discountPercent: 0,
  discountAmount: 0,
  afterDiscountValue: 0,
  billTo: '',
  shipTo: '',
  despatchMode: 'By Air',
  paymentTerms: '',
  freightCharges: '',
  freighttaxAmount: '',
  taxPercent: '',
  packingCharges: '',
  lineItems: [],
});
openNewForm = () => {
  this.setState({
    showForm: true,
    editingId: null,
    formData: this.getEmptyInvoiceForm() // fresh blank form
  });
};

  loadinvoiceForEdit = (invoice) => {
  const normalizedLineItems = (invoice.lineItems || []).map(item => {
    const qty = parseFloat(item.qty || 0);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const baseTotal = qty * unitPrice;
    const taxAmt = item.taxAmt ? parseFloat(item.taxAmt) : this.calcTaxAmt(item);
    const itemTotal = item.itemTotal ? parseFloat(item.itemTotal) : (baseTotal + taxAmt);

    return {
      ...item,
      qty,
      unitPrice,
      taxAmt: taxAmt.toFixed(2),
      itemTotal: itemTotal.toFixed(2),
      taxGroupNames: item.taxGroupNames || (item.taxGroup ? [item.taxGroup] : [])
    };
  });

  this.setState({
    formData: {
      ...invoice,
      lineItems: normalizedLineItems
    },
    editingId: invoice.id,
    showForm: true,
    activeTab: 'co'
  }, this.recalculateDirectBillingTotals);
};

toggleInvoiceForm = () => {
  this.setState({
    showForm: true,
    editingId: null,
    formData: this.getEmptyInvoiceForm(),
  });
};

  showOverlay = (type) => this.setState({ overlayType: type, overlaySearch: '' });
  hideOverlay = () => this.setState({ overlayType: '', overlaySearch: '' });

  selectOverlayValue = (value) => {
    if (this.state.overlayType === 'customer') {
      this.setState(prev => ({
        formData: {
          ...prev.formData,
          customer: value.custname || value.custcode || '', // Use custname or custcode
          billTo: this.formatAddress(value.billTo),
          shipTo: this.formatAddress(value.shipTo),
          currency: value.currency || '',
          // despatchMode: value.despatchMode || '', // No auto-fill for despatch mode
          // paymentTerms: value.paymentTerms || '' // No auto-fill for payment terms
        },
        overlayType: '',
        overlaySearch: ''
      }), () => {
        if (this.customerInputRef.current) {
          this.customerInputRef.current.value = value.custname || value.custcode || '';
        }
      });
    }
  };


 renderOverlay = () => {
  const { overlayType, overlaySearch, customers, despatchModes, paymentTerms } = this.state;

  const getFilteredRows = (list, nameKey = 'name', codeKey = 'shortName') =>
    list.filter(item =>
      (item[nameKey] || '').toLowerCase().includes((overlaySearch || '').toLowerCase()) ||
      (item[codeKey] || '').toLowerCase().includes((overlaySearch || '').toLowerCase())
    );

  const handleSelect = (item) => {
    if (overlayType === 'customer') {
      this.selectOverlayValue(item);
    } else if (overlayType === 'despatchMode') {
      this.setState(prev => ({
        formData: {
          ...prev.formData,
          despatchMode: item.name
        },
        overlayType: '',
        overlaySearch: ''
      }));
    } else if (overlayType === 'paymentTerms') {
      this.setState(prev => ({
        formData: {
          ...prev.formData,
          paymentTerms: item.name
        },
        overlayType: '',
        overlaySearch: ''
      }));
    }
  };

  let title = '';
  let headers = [];
  let rows = [];

  if (overlayType === 'customer') {
    title = 'Select Customer';
    headers = ['Name', 'Code', 'Short Name'];
    rows = getFilteredRows(customers, 'custname', 'custcode');
  } else if (overlayType === 'despatchMode') {
    title = 'Select Despatch Mode';
    headers = ['Name'];
    rows = getFilteredRows(despatchModes);
  } else if (overlayType === 'paymentTerms') {
    title = 'Select Payment Terms';
    headers = ['Name'];
    rows = getFilteredRows(paymentTerms);
  } else {
    return null;
  }

  return (
    <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="custom-overlay-title">{title}</div>
        <input
          type="text"
          className="form-control mb-2"
          placeholder={`Search ${overlayType}...`}
          value={overlaySearch}
          onChange={e => this.setState({ overlaySearch: e.target.value })}
        />
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                {headers.map((h, i) => <th key={i}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, i) => (
                <tr key={item.id || i} onClick={() => handleSelect(item)} style={{ cursor: 'pointer' }}>
                  {headers.map((h, j) => (
                    <td key={j}>
                      {overlayType === 'customer'
                        ? h === 'Name' ? item.custname
                          : h === 'Code' ? item.custcode
                          : item.custshortName
                        : h === 'Name' ? item.name
                          : item.shortName}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={headers.length} className="text-center">No records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button className="btn btn-secondary btn-sm mt-2" onClick={this.hideOverlay}>Cancel</button>
      </div>
    </div>
  );
};


renderTaxOverlay = () => {
  const { taxGroups, currentTaxIdx, formData } = this.state;
  if (currentTaxIdx === null) return null;
  const item = formData.lineItems[currentTaxIdx];
  const selected = new Set(item.taxGroupNames || []);
  return (
    <div style={{
      position: 'fixed', zIndex: 1000, top: '18%', left: '20%',
      background: '#fff', border: '1px solid #ccc', padding: '20px',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)', width: '70%',
      maxHeight: '70vh', overflowY: 'auto'
    }}>
      <h5>Select Tax Groups</h5>
      <table className="table table-sm table-bordered">
        <thead>
          <tr><th></th><th>Group</th><th>Components</th><th>%</th></tr>
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
        </tbody>
      </table>
      <div className="text-right mt-3">
        <button className="btn btn-sm btn-success" onClick={() => this.setState({ showTaxOverlay: false, currentTaxIdx: null })}>
          Done
        </button>
      </div>
    </div>
  );
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
  // recalculate taxAmt and total// after changing taxGroupNames on the item:
item.taxAmt = this.calcTaxAmt(item); // numeric
item.itemTotal = this.calcItemTotal(item.qty, item.unitPrice, item.taxAmt); // numeric
this.setState({ formData }, this.recalculateDirectBillingTotals);

};

calcTaxAmt = (item) => {
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
  const baseTotal = (parseFloat(item.unitPrice || 0) * parseFloat(item.qty || 0));
  const tax = ((baseTotal * percent) / 100 + amount);
  return isNaN(tax) ? 0 : tax;
};

calcItemTotal = (qty, unitPrice, taxAmt) => {
  qty = parseFloat(qty) || 0;
  unitPrice = parseFloat(unitPrice) || 0;
  taxAmt = parseFloat(taxAmt) || 0;
  return (qty * unitPrice) + taxAmt;
};

recalculateDirectBillingTotals = () => {
  const fd = this.state.formData;
  const lineItems = fd.lineItems || [];

  let lineBaseTotal = 0;
  let lineTaxTotal = 0;

  const updatedLineItems = lineItems.map(item => {
    const qty = parseFloat(item.qty || 0);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const baseTotal = qty * unitPrice;
    const taxAmt = this.calcTaxAmt(item); // numeric
    const itemTotal = baseTotal + taxAmt;

    lineBaseTotal += baseTotal;
    lineTaxTotal += taxAmt;

    return {
      ...item,
      taxAmt: taxAmt.toFixed(2),
      itemTotal: itemTotal.toFixed(2)
    };
  });

  const freight = parseFloat(fd.freightCharges) || 0;
  const packing = parseFloat(fd.packingCharges) || 0;
  const taxPercent = parseFloat(fd.taxPercent) || 0;

  // freight tax only applies for None/CIF
  const freightTax = (['None', 'CIF'].includes(fd.impExp)) ? (freight * taxPercent) / 100 : 0;

  const totalTaxAmount = lineTaxTotal + freightTax;
  const invoiceValue = lineBaseTotal + freight + packing + totalTaxAmount;

    let discountAmount = '';
  let afterDiscountValue = '';

  if (fd.discountPercent !== '' && fd.discountPercent !== null && !isNaN(fd.discountPercent)) {
    const dPercent = parseFloat(fd.discountPercent) || 0;
    discountAmount = ((invoiceValue * dPercent) / 100).toFixed(2);
    afterDiscountValue = (invoiceValue - parseFloat(discountAmount)).toFixed(2);
  }

  this.setState(prev => ({
    formData: {
      ...prev.formData,
      lineItems: updatedLineItems,
      taxAmount: totalTaxAmount.toFixed(2),
      freighttaxAmount: freightTax.toFixed(2),
      invoiceValue: invoiceValue.toFixed(2),
      discountAmount,
      afterDiscountValue,
    }
  }));
};

  renderProductOverlay = () => {
    const { filteredProducts, productOverlaySearch, selectedProductIds } = this.state;
const filtered = filteredProducts.filter(p =>
  (p.ptshortName || '').toLowerCase().includes(productOverlaySearch.toLowerCase()) ||
  (p.ptdescription || '').toLowerCase().includes(productOverlaySearch.toLowerCase()) ||
  (p.itemCode || '').toLowerCase().includes(productOverlaySearch.toLowerCase())
);
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="custom-overlay-title">Select Products</div>
            <button
              className="btn btn-success btn-sm"
              onClick={() => {
                const selectedProducts = filteredProducts.filter(p => this.state.selectedProductIds.includes(p.id));
                this.setState(prev => ({
                  formData: {
                    ...prev.formData,
                    lineItems: [
                      ...prev.formData.lineItems,
                      ...selectedProducts
                        .filter(p => !prev.formData.lineItems.some(item => item.id === p.id))
                        .map(p => ({
                          id: p.id,
                          itemCode: p.productId || '',
                          itemDescription: p.ptdescription || '',
                          itemType: p.itemType || '',
                          materialType: p.materialType || '',
                          onHand: p.onHand || 0,
                          taxGroup: p.taxGroup || '',
                          custPartNo: p.custPartNo || '', // Assuming this is cust part table
                          hsnCode: p.hsnCode || '', // Assuming HSN No.
                          unitPrice: p.unitPrice || 0,
                          qty: 1,
                          taxAmt:0,
                          itemTotal: (p.unitPrice || 0).toFixed(2)
                        }))
                    ]
                  },
                  productOverlayVisible: false,
                  selectedProductIds: []
                }));
              }}
            >Add Selected</button>
          </div>
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Search products..."
            value={productOverlaySearch}
            onChange={e => this.setState({ productOverlaySearch: e.target.value })}
          />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th></th>
                  <th>Item Code</th>
                  <th>Item Desc</th>
                  <th>Item Type</th>
                  <th>Material Type</th>
                  <th>On Hand</th>
                  <th>Tax Grp</th>
                  <th>Cust Part No</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={e => {
                          const checked = e.target.checked;
                          this.setState(prev => ({
                            selectedProductIds: checked
                              ? [...prev.selectedProductIds, p.id]
                              : prev.selectedProductIds.filter(id => id !== p.id)
                          }));
                        }}
                      />
                    </td>
                    <td>{p.productId}</td>
                    <td>{p.ptdescription || ''}</td>
                    <td>{p.itemType || ''}</td>
                    <td>{p.materialType || ''}</td>
                    <td>{p.onHand || 0}</td>
                    <td>{p.taxGroup || ''}</td>
                    <td>{p.custPartNo || ''}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center">No products found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
           <div className="d-flex justify-content-end mt-2">
          <button
            className="btn btn-secondary btn-sm"
onClick={() => this.setState({ productOverlayVisible: false, selectedProductIds: [] })}>            Cancel
          </button>
        </div>
        </div>
      </div>
    );
  };

  renderinvoiceTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Invoices</h4>
          <button className="btn btn-primary" onClick={this.openNewForm}>Create Invoice</button>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr style={{ fontSize: '14px' }}>
                <th>Bill No</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Bill Value</th>
                <th>After Discount</th>
                <th>Status</th>
                <th>Print</th>
              </tr>
            </thead>
            <tbody>
              {this.state.invoices.map((q, i) =>  {
                let statusClass = "badge-secondary";
                if (q.status === "Awaiting Approval") statusClass = "badge-warning";
                else if (q.status === "Amended") statusClass = "badge-info";
                else if (q.status === "Approved") statusClass = "badge-success";
                else if (q.status === "Cancelled") statusClass = "badge-danger";

                return (
                <tr key={i} style={{ fontSize: '14px' }}>
                  <td>
                    <button
                      className="btn btn-link p-0"
                      onClick={() => this.loadinvoiceForEdit(q)}
                    >
                      {q.invoiceNo}
                    </button>
                  </td>
                  <td>{q.customer}</td>
                  <td>{q.invoiceDate}</td>
                  <td>{q.invoiceValue}</td>
                  <td>{q.afterDiscountValue}</td>
                  <td>
                    <label className={`badge ${statusClass}`}
                      style={{ fontSize: '14px' }}>
                    {q.status}</label></td>
                    <td>
                      <i
                        className="mdi mdi-printer menu-icon"
                        onClick={() => this.showDirectBillingPDFWithOrg(q)}
                        style={{ fontSize: '24px', color: '#2196F3', cursor: 'pointer' }}
                      ></i>
                    </td>
                 
                </tr>
                );
})}
              {this.state.invoices.length === 0 && (
                <tr><td colSpan="6" className="text-center">No Direct Bill found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  renderinvoiceForm = () => {
    const { formData, overlayType, productOverlayVisible } = this.state;
    const isFOB = formData.impExp === 'FOB';

    return (
      <div>
        <div className="card full-height">
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <h4 className="mb-3">Direct Bill Form</h4>
            <ul className="nav nav-tabs" role="tablist">
              <li className="nav-item">
                <button type="button" className={`nav-link ${this.state.activeTab === 'co' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'co' })}>CO Details</button>
              </li>
              <li className="nav-item">
                <button type="button" className={`nav-link ${this.state.activeTab === 'commercial' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'commercial' })}>Commercial Terms</button>
              </li>
            </ul>
            <form className="form-sample" onSubmit={this.handleSubmit}>
              <div className="tab-content pt-3">
                {this.state.activeTab === 'co' && (
                  <>
                    <div className="form-row">
                      <div className="form-group col-md-3">
                        <label>Bill No</label>
                        <input type="text" className="form-control form-control-sm" value={formData.invoiceNo} onChange={(e) => this.handleInputChange('invoiceNo', e.target.value)} />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Bill Date</label>
                        <input type="date" className="form-control form-control-sm" value={formData.invoiceDate} onChange={(e) => this.handleInputChange('invoiceDate', e.target.value)} />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Bill Type</label>
                        <select className="form-control form-control-sm" value={formData.invoiceType} onChange={(e) => this.handleInputChange('invoiceType', e.target.value)}>
                          <option>Standard</option>
                          <option>Manual</option>
                        </select>
                      </div>
                      <div className="form-group col-md-3">
                        <label>Status</label>
                        <input type="text" className="form-control form-control-sm" value={formData.status}   style={{ backgroundColor: '#fff' }} readOnly />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-4">
                        <label>Customer</label>
                        <div className="input-group input-group-sm">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Choose Customer"
                            ref={this.customerInputRef}
                            value={formData.customer}
                            readOnly
                            onClick={() => this.showOverlay('customer')}
                            style={{ cursor: 'pointer' }}
                          />
                          <div className="input-group-append">
                            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => this.showOverlay('customer')}>Select</button>
                          </div>
                        </div>
                      </div>
                      <div className="form-group col-md-3">
                        <label>IMP/EXP</label>
                        <select
                          className="form-control form-control-sm"
                          value={formData.impExp}
                          onChange={(e) => this.handleInputChange('impExp', e.target.value)}
                        >
                          <option>None</option>
                          <option>COB</option>
                          <option>FOB</option>
                          <option>CIF</option>
                        </select>
                      </div>
                      <div className="form-group col-md-2">
                        <label>Ref No.</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.qrefNo}
                          onChange={(e) => this.handleInputChange('qrefNo', e.target.value)}
                        />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Choose</label>
                        <div className="d-flex align-items-center">
                          <div className="form-check mr-4">
                            <input type="radio" className="form-check-input" name="choose" id="chooseService" value="Service"
                              checked={formData.choose === 'Service'}
                              onChange={e => this.handleChooseChange(e.target.value)}
                            />
                            <label className="form-check-label" htmlFor="chooseService">Service</label>
                          </div>
                          <div className="form-check mr-4">
                            <input type="radio" className="form-check-input" name="choose" id="chooseProduct" value="Product"
                              checked={formData.choose === 'Product'}
                              onChange={e => this.handleChooseChange(e.target.value)}
                            />
                            <label className="form-check-label" htmlFor="chooseProduct">Product</label>
                          </div>
                          <div className="form-check">
                            <input type="radio" className="form-check-input" name="choose" id="chooseBundle" value="Bundle"
                              checked={formData.choose === 'Bundle'}
                              onChange={e => this.handleChooseChange(e.target.value)}
                            />
                            <label className="form-check-label" htmlFor="chooseBundle">Bundle (Service+Product)</label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-3">
                        <label>Currency</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.currency}
                          style={{ backgroundColor: '#fff' }}
                          readOnly
                        />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Conversion Rate</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={formData.conversionRate}
                          onChange={(e) => this.handleInputChange('conversionRate', e.target.value)}
                        />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Tax Amount</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={formData.taxAmount}
                          onChange={(e) => this.handleInputChange('taxAmount', e.target.value)}
                          readOnly={isFOB} // Read-only if FOB
                        />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Bill Value</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={formData.invoiceValue}
                          onChange={(e) => this.handleInputChange('invoiceValue', e.target.value)}
                          readOnly={isFOB} // Read-only if FOB
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-4">
                      <label>Discount %</label>
                      <input
                      type="number"
                      className="form-control form-control-sm"
                      value={formData.discountPercent}
                      onChange={e => {
                        this.handleInputChange('discountPercent', e.target.value);
                        this.recalculateDirectBillingTotals();
                      }}
                    />
                    </div>
                    
                    <div className="form-group col-md-4">
                    <label>Discount Amount</label>
                    <input
                      type="number"
                      className="form-control"
                      value={this.state.formData.discountAmount}
                      readOnly
                    />
                  </div>
                  <div className="form-group col-md-4">
                      <label>After Discount - Quote Value</label>
                      <input
                        type="number"
                        className="form-control"
                        value={this.state.formData.afterDiscountValue}
                        readOnly
                      />
                    </div>
                </div>
                   
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h4 className="card-title">Line Item</h4>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => this.setState({ productOverlayVisible: true })}>
                              + Add Item
                            </button>
                          </div>
                          <div className="table-responsive">
                            <table className="table table-bordered">
                              <thead className="thead-light">
                                <tr >
                                  <th>Item Code </th>
                                  <th>Item Desc </th>
                                  <th>Cust Part No </th>
                                  <th>HSN No </th>
                                  <th>On Hand </th> 
                                  <th>Unit Price</th>
                                  <th>Quantity</th>
                                  <th>Tax Id</th>
                                  <th>Tax Amt</th>
                                  <th>Item Total</th>
                                  
                                </tr>
                              </thead>
                              <tbody>
                                {formData.lineItems.map((item, idx) => (
                                  <tr key={item.id || idx}>
                                    <td>{item.itemCode}</td>
                                    <td>{item.itemDescription}</td>
                                    <td>{item.custPartNo}</td>
                                    <td>{item.hsnCode}</td>
                                    <td>{item.onHand}</td>
                                    <td>
                                      <input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={e => this.handleLineItemChange(idx, 'unitPrice', e.target.value)}
                                        style={{ width: 80 }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.qty}
                                        onChange={e => this.handleLineItemChange(idx, 'qty', e.target.value)}
                                        style={{ width: 60 }}
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
                                
                                {this.state.showTaxOverlay && this.renderTaxOverlay()}
                                <td>{item.taxAmt || '0.00'}</td>
                                    <td>{item.itemTotal || '0.00'}</td>
                                      
                                  </tr>
                                ))}
                                {formData.lineItems.length === 0 && (
                                  <tr>
                                    <td colSpan="9" className="text-center">No items</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          {/* Add pagination for line items here if needed */}
                          <div className="d-flex justify-content-between align-items-center mt-2">
                            <span>Page 1 of 1</span>
                          </div>
                      
                  </>
                )}
                {this.state.activeTab === 'commercial' && (
                  <>
                    <div className="form-row">
                      <div className="form-group col-md-6">
                        <label>Bill To</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows="3"
                          value={formData.billTo}
                          onChange={(e) => this.handleInputChange('billTo', e.target.value)}
                        />
                      </div>
                      <div className="form-group col-md-6">
                        <label>Ship To</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows="3"
                          value={formData.shipTo}
                          onChange={(e) => this.handleInputChange('shipTo', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                    <div className="form-group col-md-4">
  <label>Despatch Mode</label>
  <div className="input-group input-group-sm">
    <input
      type="text"
      className="form-control"
      value={formData.despatchMode}
      readOnly
      onClick={() => !isFOB && this.showOverlay('despatchMode')}
      style={{ cursor: isFOB ? 'not-allowed' : 'pointer', backgroundColor: '#fff' }}
    />
    <div className="input-group-append">
      <button
        className="btn btn-outline-secondary btn-sm"
        type="button"
        disabled={isFOB}
        onClick={() => this.showOverlay('despatchMode')}
      >
        Select
      </button>
    </div>
  </div>
</div>

<div className="form-group col-md-4">
  <label>Payment Terms</label>
  <div className="input-group input-group-sm">
    <input
      type="text"
      className="form-control"
      value={formData.paymentTerms}
      readOnly
      onClick={() => !isFOB && this.showOverlay('paymentTerms')}
      style={{ cursor: isFOB ? 'not-allowed' : 'pointer', backgroundColor: '#fff' }}
    />
    <div className="input-group-append">
      <button
        className="btn btn-outline-secondary btn-sm"
        type="button"
        disabled={isFOB}
        onClick={() => this.showOverlay('paymentTerms')}
      >
        Select
      </button>
    </div>
  </div>
</div>

                      <div className="form-group col-md-4">
                        <label>Freight Charges</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={formData.freightCharges}
                          onChange={(e) => this.handleInputChange('freightCharges', e.target.value)}
                          readOnly={isFOB} // Read-only if FOB
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-4">
                        <label>Tax %</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={formData.taxPercent}
                          onChange={(e) => this.handleInputChange('taxPercent', e.target.value)}
                          readOnly={isFOB} // Read-only if FOB
                        />
                      </div>
                      <div className="form-group col-md-4">
                        <label>Freight Tax Amount</label>
<input
  type="number"
  className="form-control form-control-sm"
  value={formData.freighttaxAmount || ''}
  readOnly
/>

                      </div>
                      <div className="form-group col-md-4">
                        <label>Packing Charges</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={formData.packingCharges}
                          onChange={(e) => this.handleInputChange('packingCharges', e.target.value)}
                          readOnly={isFOB} // Read-only if FOB
                        />
                      </div>
                    </div>
                    <div className="text-right mt-3">
                      <button type="submit" className="btn btn-success">Save All Details</button>
                    </div>
                  </>
                )}
              </div>
              <div className="fixed-card-footer text-right p-3 border-top bg-white">
                <button type="submit" className="btn btn-success mr-2">Save All Details</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => this.setState({ showForm: false, editingId: null })}
                >
                  Cancel
                </button>
              </div>
            </form>
            {overlayType && this.renderOverlay()}
            {productOverlayVisible && this.renderProductOverlay()}
          </div>
           
        </div>
      </div>
    );
  };

  render() {
  return (
    <div className="container-fluid">
      {this.state.previewMode
        ? this.renderinvoicePreview()
        : this.state.showForm
        ? this.renderinvoiceForm()
        : this.renderinvoiceTable()}
    </div>
  );
}

}


export default DirectBilling;