import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import bsCustomFileInput from 'bs-custom-file-input';
import { db } from '../../../../firebase';
import { collection, getDocs, addDoc, doc, updateDoc,serverTimestamp } from 'firebase/firestore';
import { withRouter } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { recalculateTotals,getTaxDetailsFromGroup} from '../calculation';
import { toWords } from 'number-to-words';
const amount = 12345678;
const amountWords = `INR ${toWords(amount)} Only`;

class Quote extends Component {
  state = {
    activeTab: 'co',
    quotes: [],
    customers: [],
    products: [],
    despatchModes: [],
    paymentTerms: [],
    showForm: false,
    showTaxOverlay: false,
    currentTaxLineIdx: null,
    editingId: null,
    overlayType: '',
    overlaySearch: '',
    productOverlayVisible: false,
    productOverlaySearch: '',
    selectedProductIds: [],
    selectedTaxGroups: [],
    taxComponents: [],
    taxGroups:[],
    previewMode: false,
    selectedQuote: null,
    breakdownItems: [], 
    breakdownType: 'Percentage',
    breakdownSelectAll: false,
    showSubProductDialog: false,
    currentBreakdownIdx: null,
     searchTerm:'',
    subProductForm: { name: '', value: '', type: 'Amount', dueDate: '' },
    formData: {
      quoteNo: '',
      quoteDate: new Date().toISOString().split('T')[0],
      quoteType: 'Standard',
      customer: '',
      status: 'Entered', 
      choose: 'Service',
      qrefNo: '',
      impExp: 'None',
      currency: '',
      conversionRate: '',
      taxAmount: '',
      quoteValue: '',
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

handleOverlayClose = () => {
  this.setState({
    overlayType: '',
    overlaySearch: '',
    productOverlayVisible: false,
    showTaxOverlay: false,
    currentTaxLineIdx: null,
    selectedProductIds: [],
  });
};
  recalculateQuoteTotals = () => {
  const { lineItems, discountPercent } = this.state.formData;
  let quoteValue = 0;
  let taxAmount = 0;
  (lineItems || []).forEach(item => {
    quoteValue += parseFloat(item.itemTotal || 0);
    taxAmount += parseFloat(item.taxAmt || 0);
  });
  const discountPercentNum = parseFloat(discountPercent || 0);
  const discountAmount = (parseFloat(quoteValue) * discountPercentNum) / 100;
  const afterDiscountValue = quoteValue - discountAmount;
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      quoteValue: quoteValue.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
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
    this.fetchQuotes();
    this.fetchCustomers();
    this.fetchProducts().then(() => this.filterProductsByCategory());
    this.fetchDespatchModes();
    this.fetchPaymentTerms();
    this.fetchTaxGroups();
  }
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


handleLineItemChange = (idx, field, value) => {
  const updatedItems = [...this.state.formData.lineItems];
  updatedItems[idx] = { ...updatedItems[idx], [field]: value };
  if (field === 'qty' || field === 'unitPrice' || field === 'taxAmt') {
    // Calculate taxAmt based on selected tax groups
    let percent = 0;
    let amount = 0;
    (updatedItems[idx].taxGroupNames || []).forEach(groupName => {
      const group = this.state.taxGroups.find(t => t.groupName === groupName);
      if (group && Array.isArray(group.lineItems)) {
        group.lineItems.forEach(comp => {
          const val = parseFloat(comp.percentOrAmt || 0);
          if (comp.type === 'Percentage') percent += val;
          if (comp.type === 'Amount') amount += val;
        });
      }
    });
    const qty = parseFloat(updatedItems[idx].qty || 0);
    const unitPrice = parseFloat(updatedItems[idx].unitPrice || 0);
    const baseTotal = qty * unitPrice;
    const taxAmt = ((baseTotal * percent) / 100 + amount);
    updatedItems[idx].baseTotal=baseTotal.toFixed(2);
    updatedItems[idx].taxAmt = taxAmt.toFixed(2);
    updatedItems[idx].itemTotal = (baseTotal + taxAmt).toFixed(2);
  }
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      lineItems: updatedItems
    }
  }), this.recalculateQuoteTotals);
};



componentDidUpdate(prevProps, prevState) {
 
}

fetchTaxGroups = async () => {
  const snap = await getDocs(collection(db, 'taxGroups'));
  const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  this.setState({ taxGroups: data });
};


  fetchQuotes = async () => {
    const snap = await getDocs(collection(db, 'quotes'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    data.sort((a,b)=>{
      const dateA=new Date(a.quoteDate || a.createdAt?.toDate?.() || a.createdAt || 0);
      const dateB=new Date(b.quoteDate || b.createdAt?.toDate?.() || b.createdAt || 0);
      return dateA - dateB;
    });
    this.setState({ quotes: data.reverse() });
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
toggleTaxGroupSelection = (groupName, lineIdx, checked) => {
  this.setState(prev => {
    const lineItems = [...prev.formData.lineItems];
    const item = { ...lineItems[lineIdx] };
    let taxGroupNames = Array.isArray(item.taxGroupNames) ? [...item.taxGroupNames] : [];
    if (checked) {
      if (!taxGroupNames.includes(groupName)) taxGroupNames.push(groupName);
    } else {
      taxGroupNames = taxGroupNames.filter(g => g !== groupName);
    }
    item.taxGroupNames = taxGroupNames;
    item.taxGroupName = taxGroupNames.join(', ');
    lineItems[lineIdx] = item;
    const { updatedLineItems, freighttaxAmount, taxAmount, quoteValue } = recalculateTotals({
      lineItems,
      freightCharges: prev.formData.freightCharges,
      packingCharges: prev.formData.packingCharges,
      taxPercent: prev.formData.taxPercent,
      taxGroups: prev.taxGroups
    });

    return {
      formData: {
        ...prev.formData,
        lineItems: updatedLineItems,
        freighttaxAmount,
        taxAmount,
        quoteValue
      }
    };
  });
};

handleInputChange = (field, value) => {
  this.setState(prev => {
    let newFormData = { ...prev.formData, [field]: value };
    if (field === "quoteType") {
      if (value === "Standard") {
        newFormData.quoteNo = `QT${1000 + (prev.quotes ? prev.quotes.length : 0)}`;
      } else {
        newFormData.quoteNo = "";
      }
    }

    return { formData: newFormData };
  }, () => {
    if (['freightCharges', 'taxPercent', 'packingCharges'].includes(field)) {
      const { updatedLineItems, freighttaxAmount, taxAmount, quoteValue } = recalculateTotals({
        lineItems: this.state.formData.lineItems,
        freightCharges: this.state.formData.freightCharges,
        packingCharges: this.state.formData.packingCharges,
        taxPercent: this.state.formData.taxPercent,
        taxGroups: this.state.taxGroups
      });
      this.setState(prev => ({
        formData: {
          ...prev.formData,
          lineItems: updatedLineItems,
          freighttaxAmount,
          taxAmount,
          quoteValue
        }
      }));
    }
  });
};


handleBreakdownSelectAll = (checked) => {
  this.setState(prev => ({
    breakdownSelectAll: checked,
    breakdownItems: prev.breakdownItems.map(item => ({ ...item, selected: checked }))
  }));
};
handleBreakdownRowSelect = (idx, checked) => {
  this.setState(prev => {
    const items = [...prev.breakdownItems];
    items[idx].selected = checked;
    return { breakdownItems: items };
  });
};

// Handler for per/amt dropdown
handleBreakdownTypeChange = (type) => {
  this.setState({ breakdownType: type });
};

handleBreakdownValueChange = (idx, value) => {
  this.setState(prev => {
    const items = [...prev.breakdownItems];
    items[idx].value = value;
    return { breakdownItems: items };
  });
};
updateStatus = async (id, status) => {
  await updateDoc(doc(db, "quotes", id), { status });
  alert(`Quote ${status}`);
  this.fetchQuotes();
  this.setState({ previewMode: false });
};
handleBreakdownDateChange = (idx, value) => {
  this.setState(prev => {
    const items = [...prev.breakdownItems];
    items[idx].lastDate = value;
    return { breakdownItems: items };
  });
};
saveBreakdownToSession = () => {
  sessionStorage.setItem('breakdownItems', JSON.stringify(this.state.breakdownItems));
};
loadBreakdownFromSession = () => {
  const data = sessionStorage.getItem('breakdownItems');
  if (data) this.setState({ breakdownItems: JSON.parse(data) });
};

handleSubmit = async (e) => {
  e.preventDefault();
  const { editingId, formData, quotes } = this.state;

  if (!formData.customer) return alert("Customer is required");
  if (formData.lineItems.length === 0) return alert("At least one line item is required");
  if (!this.isBreakdownValid()) {
    return alert("Please complete the breakdown: each product's subproduct totals must match the product total.");
  }

  const payload = {
    ...formData,
    status: "Awaiting for Approval",
    breakdownItems: this.state.breakdownItems || []
  };

  if (editingId) {
    await updateDoc(doc(db, 'quotes', editingId), payload);
  } else {
    payload.quoteNo = `QT${1000 + quotes.length}`;
    await addDoc(collection(db, "quotes"), {
      ...payload,
      status: "Awaiting for Approval",
      createdAt: serverTimestamp()
    });
  }

  this.setState({ showForm: false, editingId: null });
  this.fetchQuotes();
};

loadQuotePreview = (q) => {
  this.setState({
    selectedQuote: q,
    previewMode: true
  });
};


 loadQuoteForEdit = (quote) => {
  this.setState({
    formData: {
      ...quote,
      lineItems: Array.isArray(quote.lineItems) ? quote.lineItems : []
    },
    breakdownItems: Array.isArray(quote.breakdownItems) ? quote.breakdownItems : [],
    editingId: quote.id,
    showForm: true,
    previewMode: false,
    activeTab: 'co'
  }, () => {
    if (this.customerInputRef.current) {
      this.customerInputRef.current.value = quote.customer;
    }
  });
};

convertToOrder = (quoteObj) => {
  sessionStorage.setItem('quoteToConvert', JSON.stringify(quoteObj));
 this.props.history.push({
    pathname: '/sales/salestransactions/order/Order',
    state: { openForm: true, quoteId: quoteObj.id || null }
  });
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
  const total= enrichedItems.reduce((sum, item) => sum + (parseFloat(item.itemTotal) || 0), 0);
  const subtotal = enrichedItems.reduce((sum, item) => sum + ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.qty) || 0)), 0);
  const freightCharges = parseFloat(quote.freightCharges || 0);
  const freightTax = parseFloat(quote.freighttaxAmount || 0);
  const totalTaxAmount = parseFloat(quote.taxAmount || 0);
  const grandTotal = parseFloat(quote.quoteValue || (subtotal + totalTaxAmount));
  const afterDiscountValue= parseFloat(quote.afterDiscountValue || grandTotal);
  const amountWords = `INR ${toWords(Math.floor(grandTotal))} Only`;
  const isINR = (quote.currency || 'INR') === 'INR';
const conversionRate = parseFloat(quote.conversionRate || 1);
const convert = (val) => {
  if (val === undefined || val === null || isNaN(val)) return 0;
  const num = parseFloat(val);
  return isINR ? num : num * conversionRate;
};

const subtotalConv = convert(subtotal);
const freightChargesConv = convert(freightCharges);
const taxAmountConv = convert(totalTaxAmount);
const discountAmountConv = convert(quote.discountAmount || 0);
const grandTotalConv = convert(quote.afterDiscountValue || grandTotal);
  
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

    // --- before table start ---


const numCols = isINR ? 8 : 7; // dynamic columns (extra GST for INR)


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


<table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #011b56;">
  <thead>
    <tr style="background-color:#f0f0f0; text-align:center;">
      <th style="border:1px solid #011b56;">Item Code</th>
      <th style="border:1px solid #011b56;">Description</th>
      <th style="border:1px solid #011b56;">HSN</th>
      <th style="border:1px solid #011b56;">UOM</th>
      <th style="border:1px solid #011b56;">Qty</th>
      <th style="border:1px solid #011b56;">Unit Price</th>
      ${isINR ? `<th style="border:1px solid #011b56;">GST%</th>` : ''}
      <th style="border:1px solid #011b56;">Item Total</th>
    </tr>
  </thead>

  <tbody>
    ${enrichedItems.map(item => {
      const gstLabel = (item.taxGroupNames && item.taxGroupNames.length)
        ? item.taxGroupNames.join(', ')
        : (item.taxGroupName || item.taxId || '-');

      const rawTotal = item.total ? item.total : (item.qty && item.unitPrice ? item.qty * item.unitPrice : 0);

      return `
        <tr>
          <td style="border:1px solid #011b56;">${item.itemCode || '-'}</td>
          <td style="border:1px solid #011b56;">${item.itemDescription || '-'}</td>
          <td style="border:1px solid #011b56;">${item.hsnCode || '-'}</td>
          <td style="border:1px solid #011b56;">${item.uom || '-'}</td>
          <td style="border:1px solid #011b56;">${item.qty || 0}</td>
          <td style="border:1px solid #011b56;">${convert(item.unitPrice).toFixed(2)}</td>
          ${isINR ? `<td style="border:1px solid #011b56;">${gstLabel}</td>` : ''}
          <td style="border:1px solid #011b56;">${convert(total).toFixed(2)}</td>
        </tr>`;
    }).join('')}
  </tbody>

  <tfoot>
    <tr>
      <td colspan="${numCols - 1}" style="text-align:right; border:1px solid #011b56;"><b>Subtotal</b></td>
      <td style="border:1px solid #011b56;"><b>${convert(subtotal).toFixed(2)}</b></td>
    </tr>

    ${convert(totalTaxAmount) > 0 ? `
      <tr>
        <td colspan="${numCols - 1}" style="text-align:right; border:1px solid #011b56;"><b>Total Tax Amount</b></td>
        <td style="border:1px solid #011b56;"><b>${convert(totalTaxAmount).toFixed(2)}</b></td>
      </tr>` : ''}

    ${Number(convert(quote.discountAmount || 0)) > 0 ? `
      <tr>
        <td colspan="${numCols - 1}" style="text-align:right; border:1px solid #011b56;"><b>Discount Amount</b></td>
        <td style="border:1px solid #011b56;"><b>${Number(convert(quote.discountAmount || 0)).toFixed(2)}</b></td>
      </tr>` : ''}

    <tr>
      <td colspan="${numCols - 1}" style="text-align:right; border:1px solid #011b56;"><b>Grand Total</b></td>
      <td style="border:1px solid #011b56;"><b>${convert(grandTotal || afterDiscountValue || 0).toFixed(2)}</b></td>
    </tr>
  </tfoot>
</table>
`


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

let taxRows = taxGroupDetails.map(row => `
  <tr>
    <td style="border:1px solid #011b56;">${row.sno}</td>
    <td style="border:1px solid #011b56;">${row.group}</td>
    <td style="border:1px solid #011b56;">${row.peramt}</td>
    <td style="border:1px solid #011b56;">${convert(row.taxAmt).toFixed(2)}</td>
  </tr>
`).join('');

let combinedHtml = `
  <div style="font-family:Arial; padding:40px; width:100%;">
    <h2 style="margin-bottom:20px; font-size:20px;">Tax Breakdown</h2>
    <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:13px;">
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
          <td style="border:1px solid #011b56;"><b>${taxAmountConv.toFixed(2)}</b></td>
        </tr>
        <tr>
          <td colspan="3" style="text-align:right; border:1px solid #011b56;"><b>Discount Amount</b></td>
          <td style="border:1px solid #011b56;"><b>${discountAmountConv.toFixed(2)}</b></td>
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

  showOverlay = (type) => this.setState({ overlayType: type, overlaySearch: '' });
  hideOverlay = () => this.setState({ overlayType: '', overlaySearch: '' });

selectOverlayValue = async (value) => {
  if (this.state.overlayType === 'customer') {
    // Fetch conversion rate from Firestore
    let conversionRate = '';
    if (value.currency && value.currency !== 'INR') {
      const snap = await getDocs(collection(db, 'currencies'));
      const currencies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const cur = currencies.find(c => c.code === value.currency);
      conversionRate = cur ? cur.conversionRate : '';
    }
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        customer: value.custname || value.custcode || '', 
        billTo: this.formatAddress(value.billTo),
        shipTo: this.formatAddress(value.shipTo),
        currency: value.currency || '',
        conversionRate: conversionRate,
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
    headers = ['Name', 'Short Name'];
    rows = getFilteredRows(despatchModes);
  } else if (overlayType === 'paymentTerms') {
    title = 'Select Payment Terms';
    headers = ['Name', 'Short Name'];
    rows = getFilteredRows(paymentTerms);
  } else {
    return null;
  }

  return (
    <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="custom-overlay-title">{title}</div>
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
      </div>
    </div>
  );
};

renderProductOverlay = () => {
  const { filteredProducts, productOverlaySearch, selectedProductIds, currentPage = 1 } = this.state;

  const itemsPerPage = 10;
  const filtered = filteredProducts.filter(p =>
    (p.ptshortName || '').toLowerCase().includes(productOverlaySearch.toLowerCase()) ||
    (p.ptdescription || '').toLowerCase().includes(productOverlaySearch.toLowerCase()) ||
    (p.itemCode || '').toLowerCase().includes(productOverlaySearch.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="d-flex justify-content-between align-items-center mb-2">
  <div className="custom-overlay-title">Select Products</div>
  <div className="d-flex align-items-center">
    <button
      className="btn btn-primary btn-sm mr-2"
      onClick={() => {
        const selectedProducts = filteredProducts.filter(p =>
          selectedProductIds.includes(p.id)
        );
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
                  taxGroupName: p.taxGroup || '',
                  custPartNo: p.custPartNo || '',
                  hsnCode: p.hsnCode || '',
                  unitPrice: p.unitPrice || 0,
                  qty: 1,
                  total: (p.unitPrice || 0).toFixed(2)
                }))
            ]
          },
          productOverlayVisible: false,
          selectedProductIds: []
        }));
      }}
      type="button"
    >
      Add Selected
    </button>
 
  <i
    className="mdi mdi-close-box-outline"
    style={{
      fontSize: "24px",
      color: "#2196F3",
      cursor: "pointer",
    }}
    onClick={this.handleOverlayClose}
    aria-label="Close"
    type="button"
  ></i>
</div>
</div>

        <input
          type="text"
          className="form-control mb-2"
          placeholder="Search products..."
          value={productOverlaySearch}
          onChange={e => this.setState({ productOverlaySearch: e.target.value, currentPage: 1 })}
        />
        <div style={{ flex: 1, overflowY: "auto" }}>
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
              {paginated.map(p => (
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
              {paginated.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination at bottom */}
        <nav aria-label="Product pagination example">
          <ul className="pagination justify-content-end">
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
                  className="page-link"
                  onClick={() => this.setState({ currentPage: idx + 1 })}
                >
                  {idx + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button
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

// Tax overlay with cross close and Done at top-right
renderTaxOverlay = () => {
  const { taxGroups, currentTaxLineIdx, formData } = this.state;
  if (currentTaxLineIdx === null) return null;

  const item = formData.lineItems[currentTaxLineIdx];
  const selected = new Set(item.taxGroupNames || []);

  return (
    <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="custom-overlay-title">Select Tax Groups</div>
          <div>
            <button
              className="btn btn-primary btn-sm mr-2"
              onClick={() => this.setState({ showTaxOverlay: false })}
              type="button"
            >
              Submit
            </button>
            <i className="mdi mdi-close-box-outline"
              style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }} 
              onClick={this.handleOverlayClose}
              aria-label="Close"
              type="button"
            >
            </i>
          </div>
        </div>
        <table className="table table-sm table-bordered">
          <thead style={{ background: '#f4f6fa' }}>
            <tr>
              <th></th>
              <th>Group</th>
              <th>Components</th>
              <th>Type</th>
              <th>% / Amount</th>
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
                      this.toggleTaxGroupSelection(tg.groupName, currentTaxLineIdx, e.target.checked)
                    }
                  />
                </td>
                <td>{tg.groupName}</td>
                <td>{tg.lineItems.map(li => li.component).join(', ')}</td>
                <td>{tg.lineItems.map(li => li.type).join(', ')}</td>
                <td>{tg.lineItems.map(li => li.percentOrAmt).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

addBreakdownFromLineItems = () => {
  const { formData, breakdownItems } = this.state;
  const existing = new Set((breakdownItems || []).map(b => b.productId));
  const toAdd = (formData.lineItems || [])
    .filter(li => li.itemCode && !existing.has(li.itemCode))
    .map((li, i) => ({
      sno: (breakdownItems?.length || 0) + i + 1,
      productId: li.itemCode,
      desc: li.itemDescription || '',
      subProducts: []
    }));
  if (toAdd.length) {
    this.setState(
      { breakdownItems: [...(breakdownItems || []), ...toAdd] },
      this.saveBreakdownToSession
    );
  }
};
renderBreakdownTab = () => {
  const { breakdownItems, breakdownType, formData } = this.state;

  // map item totals from lineItems (main product totals)
  const itemTotals = (formData.lineItems || []).reduce((acc, li) => {
    acc[li.itemCode] = parseFloat(li.total || 0) || 0;
    return acc;
  }, {});
  const sumOfItemTotals = Object.values(itemTotals).reduce((s, v) => s + v, 0);

  // compute subproducts sum
  const getSubProductsSum = (bi) => {
    const mainTotal = itemTotals[bi.productId] || 0;
    const subs = Array.isArray(bi.subProducts) ? bi.subProducts : [];
    return subs.reduce((s, sp) => {
      const val = parseFloat(sp.value || 0) || 0;
      return s + (breakdownType === "Percentage" ? (mainTotal * val / 100) : val);
    }, 0);
  };

  const canSave = this.isBreakdownValid();
  const isConverted = formData?.status === " CO Created"; // 🔑 single flag

  return (
    <div>
      <h5>Milestone Breakdown</h5>

      <div className="row mb-2">
        <div className="col"><b>Quote Value:</b> {formData.quoteValue}</div>
        <div className="col"><b>After Discount Quote Value:</b> {formData.afterDiscountValue}</div>
        <div className="col"><b>Tax Amount:</b> {formData.taxAmount}</div>
        <div className="col"><b>Sum of Item Totals:</b> {sumOfItemTotals.toFixed(2)}</div>
      </div>

      {/* Mode selector + Add Breakdown button */}
      <div className="row mb-2">
        <div className="col-md-3">
          <label>Subproduct Mode</label>
          <select
            className="form-control form-control-sm"
            value={breakdownType}
            onChange={e => this.handleBreakdownTypeChange(e.target.value)}
            disabled={isConverted} // disable if converted
          >
            <option value="Amount">Amount</option>
            <option value="Percentage">Percentage</option>
          </select>
        </div>
        <div className="col-md-9 text-right">
          {!isConverted && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={this.addBreakdownFromLineItems}
            >
              + Add Breakdown
            </button>
          )}
        </div>
      </div>

      {/* ===== Table ===== */}
      <table className="table table-bordered">
        <thead className="thead-light">
          <tr>
            <th>S.No</th>
            <th>ID</th>
            <th>Desc / Subproduct name</th>
            <th>SubProduct value ({breakdownType === "Percentage" ? "%" : "₹"})</th>
            <th>Total (₹)</th>
            <th>Due Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {breakdownItems.map((item, idx) => {
            const mainItemTotal = itemTotals[item.productId] || 0;
            const subSum = getSubProductsSum(item);
            const remaining = mainItemTotal - subSum;
            const subs = Array.isArray(item.subProducts) ? item.subProducts : [];

            return (
              <React.Fragment key={idx}>
                {/* parent product row */}
                <tr style={{ background: "#eef4ff" }}>
                  <td>{item.sno}</td>
                  <td>{item.productId}</td>
                  <td>{item.desc}</td>
                  <td>
                    <div>
                      <div><small>Subproducts sum: <b>{subSum.toFixed(2)}</b></small></div>
                      <div>
                        <small>
                          Remaining:{" "}
                          <b style={{ color: remaining > 0.01 ? "red" : "green" }}>
                            {remaining.toFixed(2)}
                          </b>
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{mainItemTotal.toFixed(2)}</td>
                  <td></td>
                  <td>
                    {!isConverted && (
                      <div className="d-flex">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mr-2"
                          onClick={() => this.handleAddInlineSubProduct(idx)}
                        >+ Add</button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            if (remaining <= 0) return;
                            this.handleAddInlineSubProduct(idx, {
                              name: "New Product",
                              value: breakdownType === "Percentage"
                                ? ((remaining * 100) / (mainItemTotal || 1)).toFixed(2)
                                : remaining.toFixed(2)
                            });
                          }}
                        >Auto-fill</button>
                      </div>
                    )}
                  </td>
                </tr>

                {/* subproduct rows */}
                {subs.length === 0 && (
                  <tr key={`notice-${idx}`}>
                    <td colSpan="6" className="text-center text-muted">
                      No subproducts added for this item.
                    </td>
                  </tr>
                )}

                {subs.map((sp, spIdx) => {
                  const spId = `${item.productId}_${spIdx + 1}`;
                  const rawVal = parseFloat(sp.value || 0) || 0;
                  const spTotal = breakdownType === "Percentage"
                    ? (mainItemTotal * rawVal / 100)
                    : rawVal;

                  return (
                    <tr key={spId} style={{ background: "#f9f9f9" }}>
                      <td className="text-muted">—</td>
                      <td>{spId}</td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={sp.name || ""}
                          onChange={(e) => this.handleSubProductChange(idx, spIdx, "name", e.target.value)}
                          placeholder="Enter name"
                          disabled={isConverted}
                          style={{ paddingLeft: "18px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          className="form-control form-control-sm"
                          value={sp.value || ""}
                          onChange={(e) => this.handleSubProductChange(idx, spIdx, "value", e.target.value)}
                          disabled={isConverted}
                        />
                      </td>
                      <td>{spTotal.toFixed(2)}</td>
                      <td>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={sp.dueDate || ""}
                        onChange={(e) =>
                          this.handleSubProductChange(idx, spIdx, "dueDate", e.target.value)
                        }
                        disabled={isConverted}
                      />
                    </td>

                      <td>
                        {!isConverted && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => this.handleRemoveSubProduct(idx, spIdx)}
                          >-</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {!canSave && !isConverted && (
        <div className="alert alert-danger">
          Breakdown incomplete — for each product the sum of subproduct totals
          must equal the product total. Save disabled until fixed.
        </div>
      )}
    </div>
  );
};


renderSubProductDialog = () => {
  const { showSubProductDialog, subProductForm } = this.state;
  if (!showSubProductDialog) return null;
  return (
    <div className="custom-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="custom-overlay-content" style={{ width: 400 }}>
        <div className="form-group">
          <label>Name</label>
          <input className="form-control" value={subProductForm.name} onChange={e => this.setState({ subProductForm: { ...subProductForm, name: e.target.value } })} />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select className="form-control" value={subProductForm.type} onChange={e => this.setState({ subProductForm: { ...subProductForm, type: e.target.value } })}>
            <option value="Amount">Amount</option>
            <option value="Percentage">Percentage</option>
          </select>
        </div>
        <div className="form-group">
          <label>{subProductForm.type}</label>
          <input className="form-control" type="number" value={subProductForm.value} onChange={e => this.setState({ subProductForm: { ...subProductForm, value: e.target.value } })} />
        </div>
        <div className="form-group">
          <label>Due Date</label>
          <input className="form-control" type="date" value={subProductForm.dueDate} onChange={e => this.setState({ subProductForm: { ...subProductForm, dueDate: e.target.value } })} />
        </div>
        <div className="text-right">
          <button type="button" className="btn btn-secondary mr-2" onClick={() => this.setState({ showSubProductDialog: false })}>Cancel</button>

          <button type="button" className="btn btn-primary" onClick={(e) => {
            e.preventDefault();  //  this prevents the form submission
            this.handleAddSubProduct();
          }}>Add</button>

        </div>
      </div>
    </div>
  );
};
// Add inline subproduct (optionally with initial data)
handleAddInlineSubProduct = (breakdownIdx, initial = null) => {
  this.setState(prev => {
    const items = [...prev.breakdownItems];
    const item = { ...items[breakdownIdx] };
    const subProducts = Array.isArray(item.subProducts) ? [...item.subProducts] : [];
    const defaultSP = { name: '', value: '', dueDate: '' };
    subProducts.push(initial ? { ...defaultSP, ...initial } : defaultSP);
    item.subProducts = subProducts;
    items[breakdownIdx] = item;
    return { breakdownItems: items };
  }, this.saveBreakdownToSession);
};

handleRemoveSubProduct = (biIdx, spIdx) => {
  this.setState(prev => {
    const items = [...prev.breakdownItems];
    const item = { ...items[biIdx] };
    const subProducts = Array.isArray(item.subProducts) ? [...item.subProducts] : [];
    subProducts.splice(spIdx, 1);
    item.subProducts = subProducts;
    items[biIdx] = item;
    return { breakdownItems: items };
  }, this.saveBreakdownToSession);
};

handleSubProductChange = (biIdx, spIdx, field, value) => {
  this.setState(prev => {
    const items = [...prev.breakdownItems];
    const item = { ...items[biIdx] };
    const subProducts = Array.isArray(item.subProducts) ? [...item.subProducts] : [];
    const sp = { ...subProducts[spIdx], [field]: value };
    subProducts[spIdx] = sp;
    item.subProducts = subProducts;
    items[biIdx] = item;
    return { breakdownItems: items };
  }, this.saveBreakdownToSession);
};

// sum of subproducts for a breakdown item (used in validation)
getSubProductsSum = (bi) => {
  const { breakdownType, formData } = this.state;
  const itemTotals = (formData.lineItems || []).reduce((acc, li) => {
    acc[li.itemCode] = parseFloat(li.total || 0) || 0;
    return acc;
  }, {});
  const mainTotal = itemTotals[bi.productId] || 0;
  const subs = Array.isArray(bi.subProducts) ? bi.subProducts : [];
  return subs.reduce((s, sp) => {
    const val = parseFloat(sp.value || 0) || 0;
    if (breakdownType === 'Percentage') {
      return s + (mainTotal * val / 100);
    }
    return s + val;
  }, 0);
};

// Check that for every main product, sum(subproducts) === mainTotal (tolerance)
isBreakdownValid = () => {
  const { breakdownItems, formData } = this.state;
  const itemTotals = (formData.lineItems || []).reduce((acc, li) => {
    acc[li.itemCode] = parseFloat(li.total || 0) || 0;
    return acc;
  }, {});
  const TOL = 0.01;
  for (let bi of breakdownItems) {
    const mainTotal = itemTotals[bi.productId] || 0;
    // require at least one subproduct for products with non-zero mainTotal
    if (mainTotal > 0) {
      const subSum = this.getSubProductsSum(bi);
      if (Math.abs(subSum - mainTotal) > TOL) return false;
    }
  }
  return true;
};

handleAddSubProduct = () => {
  const { currentBreakdownIdx, subProductForm, breakdownItems } = this.state;
  if (!subProductForm.name || !subProductForm.value) return;
  // Clone breakdownItems and subProducts for immutability
  const items = breakdownItems.map((item, idx) => {
    if (idx === currentBreakdownIdx) {
      const subProducts = Array.isArray(item.subProducts) ? [...item.subProducts] : [];
      subProducts.push({ ...subProductForm });
      return { ...item, subProducts };
    }
    return item;
  });
  this.setState({
    breakdownItems: items,
    showSubProductDialog: false,
    subProductForm: { name: '', value: '', type: 'Amount', dueDate: '' }
  }, this.saveBreakdownToSession);
};
  renderQuoteTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
       <div className="d-flex justify-content-between align-items-center mb-3">
  <h4 className="card-title mb-0">Quotes</h4>

  <div className="d-flex align-items-center" style={{ gap: '10px', width: '40%' }}>
    <input
      type="text"
      className="form-control"
      placeholder="Search by Bill No, Customer, Status, Date..."
      value={this.state.searchTerm}
      onChange={(e) => this.setState({ searchTerm: e.target.value })}
    />
    <button
    type="button"
      className="btn btn-primary"
      onClick={() => this.setState({ showForm: true })}
    >
       Create
    </button>
  </div>
</div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr style={{ fontSize: '14px' }}>
                <th>Quote No</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Quote Value</th>
                <th>After Discount</th>
                <th>Status</th>
                <th>Print</th>
              </tr>
            </thead>
            <tbody>
              {this.state.quotes
              .filter((q) =>{
                const term =this.state.searchTerm.toLowerCase();
                if(!term) return true;
                return (
                  (q.quoteNo || '').toLowerCase().includes(term) ||
                  (q.customer || '').toLowerCase().includes(term) ||
                  (q.status || '').toLowerCase().includes(term) ||
                  (q.quoteDate || '').toLowerCase().includes(term) ||
                  (q.quoteValue?.toString() || '').toLowerCase().includes(term) ||
                  (q.afterDiscountValue?.toString() || '').toLowerCase().includes(term) 
                );
              })
              .map((q, i) => {
                let statusClass = "badge-info";
                if (q.status === "Awaiting for Approval") statusClass = "badge-warning";
                else if (q.status === "CO created") statusClass = "badge-secondary";
                else if (q.status === "Cancelled") statusClass = "badge-danger";
                else if(q.status === "Approved")statusClass="badge-success";
                return (
                  <tr key={i} style={{ fontSize: '14px' }}>
                    <td>
                      <button
                        className="btn btn-link p-0"
                        onClick={() => this.loadQuotePreview(q)}
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
                <tr><td colSpan="6" className="text-center">No quotes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  renderQuoteForm = () => {
    const { formData, overlayType, productOverlayVisible,recalculateQuoteTotals ,showTaxOverlay,taxGroups} = this.state;
    const isFOB = formData.impExp === 'FOB';
    return (
      <div>
        <div className="card full-height">
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <h4 className="mb-3">Quote Form</h4>
            <ul className="nav nav-tabs" role="tablist">
              <li className="nav-item">
                <button type="button" className={`nav-link ${this.state.activeTab === 'co' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'co' })}>CO Details</button>
              </li>
              <li className="nav-item">
              <button type="button" className={`nav-link ${this.state.activeTab === 'breakdown' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'breakdown' })}>Breakdown</button>
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
                        <label>Quote Type</label>
                        <select className="form-control form-control-sm" value={formData.quoteType} onChange={(e) => this.handleInputChange('quoteType', e.target.value)}>
                          <option>Standard</option>
                          <option>Manual</option>
                        </select>
                      </div>
                      <div className="form-group col-md-3">
                      <label>Quote No</label>
                      {formData.quoteType === "Standard" ? (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.quoteNo}
                          readOnly
                          placeholder="Auto"
                        />
                      ) : (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.quoteNo}
                          onChange={e => this.handleInputChange('quoteNo', e.target.value)}
                          placeholder="Enter Quote No"
                        />
                      )}
                    </div>
                      <div className="form-group col-md-3">
                        <label>Quote Date</label>
                        <input type="date" className="form-control form-control-sm" value={formData.quoteDate} onChange={(e) => this.handleInputChange('quoteDate', e.target.value)} />
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
                            <label className="form-check-label" htmlFor="chooseBundle">Service+Product</label>
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
                          type="text"
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
                        <label>Quote Value</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={formData.quoteValue}
                          onChange={(e) => this.handleInputChange('quoteValue', e.target.value)}
                          readOnly={isFOB} // Read-only if FOB
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-4">
                      <label>Discount %</label>
                      <input
                        type="number"
                        className='form-control'
                        value={formData.discountPercent}
                        onChange={e => {
                          this.handleDiscountChange('discountPercent', e.target.value);
                          this.recalculateQuoteTotals();
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
                      value={formData.discountPercent > 0 ? formData.afterDiscountValue : ""}
                      readOnly
                      placeholder={formData.discountPercent > 0 ? "" : "Enter Discount %"}
                    />
                  </div>
                </div>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h4 className="card-title">Line Item</h4>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => this.setState({ productOverlayVisible: true })}>
                              + Add Product
                            </button>
                          </div>
                       <div className="table-responsive">
        <table className="table table-bordered">
          <thead className="thead-light">
            <tr>
              <th>Item Code</th>
              <th>Item Desc</th>
              <th>Cust Part No</th>
              <th>HSN No</th>
              <th>UOM</th>
              <th>On Hand</th>
              <th>Unit Price</th>
              <th>Quantity</th>
              <th>Tax Id</th>
              <th>Item Total</th>
             <th>Tax Amount</th>
              <th>Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {formData.lineItems.map((item, idx) => {
              const itemTotal = item.unitPrice * item.qty;
              const taxDetails = getTaxDetailsFromGroup(item.taxGroupName, this.state.taxGroups);
              const taxAmt = (itemTotal * taxDetails.totalPercent / 100) + (itemTotal * taxDetails.totalAmount);
              const totalWithTax = itemTotal + taxAmt;
             
              
              return (
                <tr key={item.id || idx}>
                  <td>{item.itemCode}</td>
                  <td>{item.itemDescription}</td>
                  <td>{item.custPartNo}</td>
                  <td>{item.hsnCode}</td>
                  <td>{item.uom}</td>
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
                    className="btn btn-outline-secondary btn-sm btn-rounded btn-icon"
                    style={{ padding: '2px 6px', fontSize: '12px', lineHeight: '1' }}
                    onClick={() => this.setState({ showTaxOverlay: true, currentTaxLineIdx: idx })}
                  >
                    +
                  </button>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    {(item.taxGroupNames || []).join(', ') || '-'}
                  </div>
                </td>
                <td>{parseFloat(item.baseTotal || 0).toFixed(2)}</td>
            <td>{parseFloat(item.taxAmt || 0).toFixed(2)}</td>
              <td>{parseFloat(item.itemTotal || 0).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                          value={formData.freighttaxAmount}
                          readOnly={isFOB} // Read-only if FOB
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
                    
                  </>
                )}
                {this.state.activeTab === 'breakdown' && (this.renderBreakdownTab())}
              </div>
              {this.renderSubProductDialog()}
              <div className="fixed-card-footer text-right p-3 border-top bg-white">
                <button
                  type="button"
                  className="btn btn-secondary mr-2"
                  onClick={() => this.setState({ showForm: false, editingId: null })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-success mr-2">Save All Details</button>
              </div>
            </form>
            {overlayType && this.renderOverlay()}
            {productOverlayVisible && this.renderProductOverlay()}
            {this.state.showTaxOverlay && this.renderTaxOverlay()}

          </div>
          
        </div>
      </div>
    );
  };

 renderQuotePreview = () => {
  const q = this.state.selectedQuote;
  const { isApprovalMode } = this.props;
  if (!q) return null;

  const subtotal = q.lineItems?.reduce(
    (sum, item) => sum + (parseFloat(item.total) || 0),
    0
  ) || 0;

  const freightCharges = parseFloat(q.freightCharges || 0);
  const taxAmount = parseFloat(q.taxAmount || 0);
  const grandTotal = parseFloat(q.quoteValue || subtotal + freightCharges + taxAmount);

  const amountWords = `INR ${window.toWords
    ? window.toWords(Math.floor(grandTotal))
    : grandTotal} Only`;

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
            className="btn btn-sm btn-primary"
            onClick={() => this.loadQuoteForEdit(q)}
            disabled={q.status === "Approved" || q.status === "CO Created"}
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
                onClick={() => this.showQuotePDFWithOrg(q)}
                style={{ marginBlockStart:'10px', gap:'10px',fontSize: '27px', color: '#2196F3', cursor: 'pointer' }}
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
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {q.lineItems?.map((item, i) => (
            <tr key={i}>
              <td>{item.itemCode}</td>
              <td>{item.itemDescription}</td>
              <td>{item.qty}</td>
              <td>{item.unitPrice}</td>
              <td>{item.total}</td>
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
       <div className="mt-auto pt-3 text-right">
        {!isApprovalMode ? (
          <>
            
            
            <button
              className="btn btn-secondary"
              onClick={() => this.setState({ previewMode: false })}
            >
              Back to List
            </button>
          </>
            ) : (
          <>
            <button
              className="btn btn-success mr-2"
              onClick={() => this.updateStatus(q.id, "Approved")}
              disabled={q.status === "Approved" || q.status === "CO Created"}
            >
              Approve
            </button>
            <button
              className="btn btn-danger mr-2"
              onClick={() => this.updateStatus(q.id, "Rejected")}
              disabled={q.status === "Rejected" || q.status === "CO Created"}
            >
              Reject
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => this.setState({ previewMode: false })}
            >
              Back to List
            </button>
          </>
        )}
      </div>

    </div>
  );
  
};



  render() {
    return (
      <div className="container-fluid">
        {this.state.previewMode? this.renderQuotePreview(): this.state.showForm ? this.renderQuoteForm() : this.renderQuoteTable()}
        

      </div>
    );
  }
}

export default withRouter(Quote);
