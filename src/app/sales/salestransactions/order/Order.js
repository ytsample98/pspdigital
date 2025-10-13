import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import bsCustomFileInput from 'bs-custom-file-input';
import { db } from '../../../../firebase';
import { collection, getDocs, addDoc, doc, updateDoc ,serverTimestamp} from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf'; 
import { toWords } from "number-to-words";
import { withRouter } from 'react-router-dom';
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

class Order extends Component {
  state = {
    activeTab: 'co',
    breakdownItems: [],
    orders: [],
    customers: [],
    products: [],
    despatchModes: [],
    paymentTerms: [],
    showForm: false,
    editingId: null,
    overlayType: '',
    overlaySearch: '',
    productOverlayVisible: false,
    productOverlaySearch: '',
    selectedProductIds: [],
    taxGroups: [],
    showTaxOverlay: false,
    currentTaxIdx: null,
     breakdownType: 'Amount', 
     searchTerm:'',
    formData: {
      orderNo: '',
      orderDate: new Date().toISOString().split('T')[0],
      orderType: 'Standard',
      customer: '',
      status: 'Entered', 
      choose: 'Service',
      qrefNo: '',
      impExp: 'None',
      currency: '',
      conversionRate: '',
      taxAmount: '',
      orderValue: '',
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

  formatAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return [
      addr.address,
      [addr.city, addr.state, addr.country].filter(Boolean).join(', '),
      addr.zip
    ].filter(Boolean).join('\n');
  };

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


calculateOrderTotals = () => {
  const { impExp, freightCharges, taxPercent, packingCharges, lineItems } = this.state.formData;

  const freight = parseFloat(freightCharges) || 0;
  const packing = parseFloat(packingCharges) || 0;
  let taxOnFreight = 0;
  if (['None', 'CIF'].includes(impExp)) {
    taxOnFreight = (freight * (parseFloat(taxPercent) || 0)) / 100;
  }

  let lineTotal = 0;      // sum of base totals (without tax)
  let itemTaxTotal = 0;   // sum of line taxes

  const updatedLineItems = (lineItems || []).map(item => {
    const qty = parseFloat(item.qty || 0);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const baseTotal = qty * unitPrice;

    // tax group(s)
    const groupNames = (item.taxGroupNames && item.taxGroupNames.length) ? item.taxGroupNames : (item.taxGroup ? [item.taxGroup] : []);
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
    const itemTotalWithTax = baseTotal + taxAmt;

    // accumulate totals
    lineTotal += baseTotal;
    itemTaxTotal += taxAmt;

    return {
      ...item,
      qty,
      unitPrice,
      baseTotal: baseTotal.toFixed(2),
      taxAmt: taxAmt.toFixed(2),
      itemTotal: itemTotalWithTax.toFixed(2)
    };
  });

  const totalTaxAmount = itemTaxTotal + taxOnFreight;
  const orderValue = lineTotal + itemTaxTotal + freight + packing + taxOnFreight;

  this.setState(prev => ({
    formData: {
      ...prev.formData,
      lineItems: updatedLineItems,
      totalTaxAmount: totalTaxAmount.toFixed(2),
      orderValue: orderValue.toFixed(2)
    }
  }));
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
    const isINR = (order.currency || 'INR') === 'INR';
const conversionRate = parseFloat(order.conversionRate || 1);

const convert = (amt) => isINR ? amt : amt * conversionRate;
const subtotalConv = convert(subtotal);
const freightChargesConv = convert(freightCharges);
const taxAmountConv = convert(totalTaxAmount);
const discountAmountConv = convert(order.discountAmount || 0);
const grandTotalConv = convert(order.afterDiscountValue || grandTotal);
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
           ${isINR ? `<th style="border:1px solid #011b56;">GST%</th>`: ''} 
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
                <td style="border:1px solid #011b56;">${convert(item.unitPrice)}</td>
                ${isINR ? `<td style="border:1px solid #011b56;">${gstLabel}</td>`: ''}
                <td style="border:1px solid #011b56;">${convert(item.total)}</td>
              </tr>`;
          }).join('')}
          <tr>
            <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Subtotal</b></td>
            <td style="border:1px solid #011b56;"><b>${convert(subtotal).toFixed(2)}</b></td>
        </tr>
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Total Tax Amount</b></td>
          <td style="border:1px solid #011b56;"><b>${convert(totalTaxAmount).toFixed(2)}</b></td>
        </tr>
        <tr>
          <td colspan="7" style="text-align:right; border:1px solid #011b56;"><b>Grand Total</b></td>
          <td style="border:1px solid #011b56;"><b>${convert(grandTotal.toFixed(2))}</b></td>
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
  this.fetchorders();
  this.fetchCustomers();
  this.fetchProducts().then(() => this.filterProductsByCategory());
  this.fetchDespatchModes();
  this.fetchPaymentTerms();
  this.fetchTaxGroups();

  // If navigated with route state (history.push with state), open form
  const navState = (this.props.location && this.props.location.state) || {};
  const openFormFromNav = navState.openForm === true;
  if (navState.openForm && navState.editId) {
    const orderToEdit = this.state.orders.find(o => o.id === navState.editId);
    if (orderToEdit) {
      this.setState(prev => ({
        formData: {
          ...prev.formData,
          ...orderToEdit,
          editingId: orderToEdit.id,
        },
        showForm: true,
      }), this.calculateOrderTotals);
    }
  }
  const quoteFromSession = sessionStorage.getItem('quoteToConvert');
  if (quoteFromSession && !this.state.showForm) {
    const quote = JSON.parse(quoteFromSession);
    sessionStorage.removeItem('quoteToConvert');

    const lineItems = (quote.lineItems || []).map(item => {
      const qty = parseFloat(item.qty || 1);
      const unitPrice = parseFloat(item.unitPrice || 0);
      const baseTotal = qty * unitPrice;
      let percent = 0;
      let amount = 0;
      (item.taxGroupNames || item.taxGroup ? (item.taxGroupNames || [item.taxGroup]) : []).forEach(groupName => {
        const group = (this.state.taxGroups || []).find(t => t.groupName === groupName);
        if (group && Array.isArray(group.lineItems)) {
          group.lineItems.forEach(comp => {
            const val = parseFloat(comp.percentOrAmt || 0);
            if (comp.type === 'Percentage') percent += val;
            if (comp.type === 'Amount') amount += val;
          });
        }
      });

      const taxAmt = (baseTotal * percent) / 100 + amount;
      const itemTotal = baseTotal + taxAmt;

      return {
        ...item,
        qty,
        unitPrice,
        taxAmt: taxAmt.toFixed(2),
        itemTotal: itemTotal.toFixed(2)
      };
    });

    // discount calculations
    const quoteValue = parseFloat(quote.quoteValue || 0) || lineItems.reduce((s, li) => s + parseFloat(li.itemTotal || 0), 0);
    const discountPercent = parseFloat(quote.discountPercent || 0) || 0;
    const discountAmount = (quoteValue * discountPercent) / 100;
    const afterDiscountValue = quoteValue - discountAmount;

    // Set form state and open form
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        ...quote,
        showForm: true,
        editingId: null,
        previewOrderMode: false,
        orderNo: `CO${1000 + prev.orders.length}`,
        orderDate: new Date().toISOString().split('T')[0],
        status: 'Entered',
        orderType: 'Standard',
        orderValue: lineItems.reduce((s, li) => s + parseFloat(li.itemTotal || 0), 0).toFixed(2),
        discountPercent,
        discountAmount: discountAmount.toFixed(2),
        afterDiscountValue: afterDiscountValue.toFixed(2),
        lineItems,
        quoteNo: quote.quoteNo || '',
        qrefNo: quote.quoteNo || ''
      },
      breakdownItems: Array.isArray(quote.breakdownItems) ? quote.breakdownItems : [],
      showForm: true
    }), () => {
      this.calculateOrderTotals();
    });

    return;
  }

  // if nav state requested open form (without session)
  if (openFormFromNav && !this.state.showForm) {
    // toggle an empty order form ready to be filled
    this.toggleOrderForm();
    // ensure totals initialized
    this.calculateOrderTotals();
  }
  if (navState.openForm && !navState.editId && !quoteFromSession) {
    this.toggleOrderForm();
  }
}

  componentDidUpdate(prevProps, prevState) {
    // Customer details auto-fill
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
            // paymentTerms: customerObj.paymentTerms || '', // No auto-fill for payment terms
            // despatchMode: customerObj.despatchMode || '' // No auto-fill for despatch mode
          }
        }));
      }
    }

    // Freight and Tax calculation based on impExp
    const { impExp, freightCharges, taxPercent,packingCharges, lineItems } = this.state.formData;
    if (['None', 'CIF'].includes(impExp)) {
      const freight = parseFloat(freightCharges) || 0;
      const tax = parseFloat(taxPercent) || 0;
      const packing = parseFloat(packingCharges) || 0;

      const taxAmount = (freight * tax) / 100;

      const lineTotal = lineItems.reduce((sum, item) => {
  const total = parseFloat(item.itemTotal) || 0;
  return sum + total;
}, 0);

const orderValue = lineTotal + freight + packing;

      if (
    this.state.formData.taxAmount !== taxAmount.toFixed(2) ||
    this.state.formData.orderValue !== orderValue.toFixed(2)
  ) {
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        taxAmount: taxAmount.toFixed(2),
        orderValue: orderValue.toFixed(2)
      }
    }));
  }
} else if (impExp === 'FOB') {
  if (
    this.state.formData.freightCharges !== '' ||
    this.state.formData.taxPercent !== '' ||
    this.state.formData.taxAmount !== '' ||
    this.state.formData.packingCharges !== ''
  ) {
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        freightCharges: '',
        taxPercent: '',
        taxAmount: '',
        packingCharges: '',
        orderValue: ''
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

  fetchorders = async () => {
    const snap = await getDocs(collection(db, 'orders'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    data.sort((a,b)=>{
      const dateA = new Date(a.orderDate || a.createdAt?.toDate?.() || a.createdAt || 0);
      const dateB = new Date(b.orderDate || b.createdAt?.toDate?.() || b.createdAt || 0);
      return dateA - dateB;
    });
    this.setState({ orders: data.reverse() });
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
  this.setState(prev => ({
    formData: { ...prev.formData, [field]: value }
  }), () => {
    if (field === 'discountPercent') this.calculateOrderTotals();
  });
};
  handleBreakdownChange = (idx, field, value) => {
  this.setState(prev => {
    const items = [...prev.breakdownItems];
    items[idx][field] = value;
    return { breakdownItems: items };
  });
};

 handleBreakdownTypeChange = (val) => {
    this.setState({ breakdownType: val });
  };

  handleAddInlineSubProduct = (breakdownIdx, initial = null) => {
    this.setState(prev => {
      const items = [...prev.breakdownItems];
      const item = items[breakdownIdx] ? { ...items[breakdownIdx] } : null;
      if (!item) return {};
      const subProducts = Array.isArray(item.subProducts) ? [...item.subProducts] : [];
      const defaultSP = { name: '', value: '' };
      subProducts.push(initial ? { ...defaultSP, ...initial } : defaultSP);
      item.subProducts = subProducts;
      items[breakdownIdx] = item;
      return { breakdownItems: items };
    });
  };
    handleRemoveSubProduct = (biIdx, spIdx) => {
    this.setState(prev => {
      const items = [...prev.breakdownItems];
      if (!items[biIdx]) return {};
      const item = { ...items[biIdx] };
      const subProducts = Array.isArray(item.subProducts) ? [...item.subProducts] : [];
      subProducts.splice(spIdx, 1);
      item.subProducts = subProducts;
      items[biIdx] = item;
      return { breakdownItems: items };
    });
  };
  handleSubProductChange = (biIdx, spIdx, field, value) => {
    this.setState(prev => {
      const items = [...prev.breakdownItems];
      if (!items[biIdx]) return {};
      const item = { ...items[biIdx] };
      const subProducts = Array.isArray(item.subProducts) ? [...item.subProducts] : [];
      const sp = { ...subProducts[spIdx], [field]: value };
      subProducts[spIdx] = sp;
      item.subProducts = subProducts;
      items[biIdx] = item;
      return { breakdownItems: items };
    });
  };
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
   isBreakdownValid = () => {
    const { breakdownItems, formData } = this.state;
    const itemTotals = (formData.lineItems || []).reduce((acc, li) => {
      acc[li.itemCode] = parseFloat(li.total || 0) || 0;
      return acc;
    }, {});
    const TOL = 0.01;
    for (let bi of breakdownItems) {
      const mainTotal = itemTotals[bi.productId] || 0;
      if (mainTotal > 0) {
        const subSum = this.getSubProductsSum(bi);
        if (Math.abs(subSum - mainTotal) > TOL) return false;
      }
    }
    return true;
  };

handleLineItemChange = (idx, field, value) => {
  const updatedItems = [...this.state.formData.lineItems];
  updatedItems[idx] = { ...updatedItems[idx], [field]: value };

  // recalc tax & totals for this line
  const qty = parseFloat(updatedItems[idx].qty || 0);
  const unitPrice = parseFloat(updatedItems[idx].unitPrice || 0);
  const baseTotal = qty * unitPrice;

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

  const taxAmt = (baseTotal * percent) / 100 + amount;
  updatedItems[idx].taxAmt = taxAmt.toFixed(2);
  updatedItems[idx].itemTotal = (baseTotal + taxAmt).toFixed(2);

  // update state + recalc full totals
  this.setState(prev => ({
    formData: { ...prev.formData, lineItems: updatedItems }
  }), this.calculateOrderTotals);
};


handleSubmit = async (e) => {
  e.preventDefault();
  const { editingId, formData, orders, breakdownItems } = this.state;
  if (!formData.customer) return alert("Customer is required");
  if (formData.lineItems.length === 0) return alert("At least one line item is required");

  formData.breakdownItems = breakdownItems;
  const payload = {
    ...formData,
    status: "Awaiting for Approval", // Always set to Awaiting for Approval on save
    breakdownItems: this.state.breakdownItems || []
  };

  let orderDocId = editingId;
  if (editingId) {
  await updateDoc(doc(db, "orders", editingId), {
    ...formData,
    breakdownItems,
    status: "Awaiting for Approval",
    updatedAt: serverTimestamp()
  });
  orderDocId = editingId;
} else {
  formData.orderNo = `CO${1000 + orders.length}`;
  const docRef = await addDoc(collection(db, "orders"), {
    ...formData,
    status: "Awaiting for Approval",
    createdAt: serverTimestamp()
  });
  // Save the docId back into the document
  await updateDoc(docRef, { id: docRef.id });
  orderDocId = docRef.id;
}


  // If this order was created from a quote, update quote status now
  if (formData.quoteNo) {
    const quoteSnap = await getDocs(collection(db, "quotes"));
    const quoteDoc = quoteSnap.docs.find(q => q.data().quoteNo === formData.quoteNo);
    if (quoteDoc) {
      await updateDoc(doc(db, "quotes", quoteDoc.id), { status: "CO Created" });
    }
  }

  this.setState({ showForm: false, editingId: null, previewOrderMode: false, formData: this.getEmptyOrderForm() });
  this.fetchorders();
};

// Helper to reset formData
getEmptyOrderForm = () => ({
  orderNo: '',
  orderDate: new Date().toISOString().split('T')[0],
  orderType: 'Standard',
  customer: '',
  status: 'Entered',
  choose: 'Service',
  qrefNo: '',
  impExp: 'None',
  currency: '',
  conversionRate: '',
  taxAmount: '',
  orderValue: '',
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

loadOrderPreview = (order) => {
  this.setState({
    selectedOrder: order,
    previewOrderMode: true
  });
};

loadorderForEdit = (order) => {
  this.setState({
    formData: {
      ...order,
      lineItems: Array.isArray(order.lineItems) ? order.lineItems : []
    },
    breakdownItems: Array.isArray(order.breakdownItems) ? order.breakdownItems : [],
    editingId: order.id,
    showForm: true,
    previewOrderMode: false, // <-- Ensure preview mode is off
    activeTab: 'co'
  }, () => {
    if (this.customerInputRef.current) {
      this.customerInputRef.current.value = order.customer;
    }
  });
};

toggleOrderForm = () => {
  this.setState(prev => ({
    showForm: !prev.showForm,
    formData: {
      ...this.initialFormData, // however you reset it
      orderNo: `CO${1000 + prev.orders.length}`,
      orderDate: new Date().toISOString().split('T')[0],
      status: 'Entered',
      lineItems: []
    }
  }), this.calculateOrderTotals);
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

  this.setState({ formData }, () => this.calculateOrderTotals());
};

  showOverlay = (type) => this.setState({ overlayType: type, overlaySearch: '' });
  hideOverlay = () => this.setState({ overlayType: '', overlaySearch: '' });

  selectOverlayValue = async(value) => {
    if (this.state.overlayType === 'customer') {
      let conversionRate='';
      if(value.currency && value.currency !== 'INR'){
        const snap=await getDocs(collection(db,'currencies'));
        const currencies=snap.docs.map(d =>({id:d.id, ...d.data()}));
        const cur=currencies.find(c => c.code === value.currency);
        conversionRate=cur?cur.conversionRate:'';
      }
      this.setState(prev => ({
        formData: {
          ...prev.formData,
          customer: value.custname || value.custcode || '', // Use custname or custcode
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
        <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="custom-overlay-title">{title}</div>
        <i className='mdi mdi-close-box-outline'
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

renderTaxOverlay = () => {
  const { taxGroups, currentTaxIdx, formData } = this.state;
  if (currentTaxIdx === null) return null;

  const item = formData.lineItems[currentTaxIdx];
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
              <th>%</th>
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
        </tbody>
      </table>
    </div>
    </div>
  );
};

renderOrderPreview = () => {
  const o = this.state.selectedOrder;
  if (!o) return null;

  const subtotal = o.lineItems?.reduce(
    (sum, item) => sum + (parseFloat(item.total) || 0),
    0
  ) || 0;

  const freightCharges = parseFloat(o.freightCharges || 0);
  const taxAmount = parseFloat(o.taxAmount || 0);
  const grandTotal = parseFloat(o.orderValue || subtotal + freightCharges + taxAmount);

  const amountWords = `INR ${window.toWords
    ? window.toWords(Math.floor(grandTotal))
    : grandTotal} Only`;

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
          className="btn btn-sm btn-primary"
          onClick={() => this.loadorderForEdit(o)}
          disabled={o.status !== "Entered" && o.status !== "Awaiting for Approval"}
        >
          Edit
        </button>
          
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
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {o.lineItems?.map((item, i) => (
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
      <div className="mt-3">
        <p><b>Subtotal:</b> {subtotal.toFixed(2)}</p>
        <p><b>Freight Charges:</b> {freightCharges.toFixed(2)}</p>
        <p><b>Tax Amount:</b> {taxAmount.toFixed(2)}</p>
        <p className="h6"><b>Grand Total:</b> {grandTotal.toFixed(2)}</p>
        <p className="h6"><b>Amount in Words:</b> {amountWords}</p>
      </div>
      <div className="mt-auto pt-3 text-right ">
        <button
          className="btn btn-secondary"
          onClick={() => this.setState({ previewOrderMode: false })}
        >
          Back to List
        </button>
      </div>
    </div>
  );
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
  const isConverted = formData?.status === "CO Created"; // 🔑 single flag

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
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => this.handleRemoveSubProduct(idx, spIdx)}
                          >-</button>
                        </>
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
    <div className="custom-overlay" 
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="custom-overlay-content"
      >
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="custom-overlay-title">Select Products</div>
          <div className="d-flex align-items-center">
            <button
              className="btn btn-primary btn-sm mr-2"
              type="button"
              onClick={() => {
                const selectedProducts = filteredProducts.filter(p => selectedProductIds.includes(p.id));
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
            >
              Add Selected
            </button>
            <i
              className="mdi mdi-close-box-outline"
              style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }}
              onClick={this.handleOverlayClose}
              aria-label="Close"
              type="button"
            ></i>
          </div>
        </div>
        {/* Search */}
        <input
          type="text"
          className="form-control mb-2"
          placeholder="Search products..."
          value={productOverlaySearch}
          onChange={e => this.setState({ productOverlaySearch: e.target.value, currentPage: 1 })}
        />
        {/* Table in scrollable area */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <table className="table table-bordered table-sm mb-0">
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
        {/* Pagination at the bottom */}
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

  renderorderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
       <div className="d-flex justify-content-between align-items-center mb-3">
  <h4 className="card-title mb-0">Customer Orders</h4>

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
                <th>Order No</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Ref No</th>
                <th>Order Value</th>
                <th>After Discount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {this.state.orders
              .filter((q)=>{
                 const term = this.state.searchTerm.toLowerCase();
                 if (!term) return true;
                 return (
                  (q.orderNo || "").toLowerCase().includes(term) ||
                  (q.customer || "").toLowerCase().includes(term) ||
                  (q.status || "").toLowerCase().includes(term) ||
                  (q.orderDate || "").toLowerCase().includes(term) ||
                  (q.qrefNo || "").toLowerCase().includes(term) ||
                  (q.orderValue?.toString() || "").toLowerCase().includes(term) ||
                  (q.afterDiscountValue?.toString() || "").toLowerCase().includes(term)
                 );
                }).map((q, i) => {

                let statusClass = "badge-secondary";
                if( q.status === "Awaiting for Approval") statusClass="badge-warning";
                else if(q.status === "CO Created") statusClass="badge-secondary";
                else if(q.status === "Approved") statusClass="badge-success";
                else if(q.status === "Rejected") statusClass="badge-danger";

                return(
                  <tr key={i} style={{ fontSize: '14px' }}>
                  <td>
                    <button
                     className="btn btn-link p-0" 
                     onClick={() => this.loadOrderPreview(q)}>
                    {q.orderNo}
                  </button>

                  </td>
                  <td>{q.customer}</td>
                  <td>{q.orderDate}</td>
                  <td>{q.qrefNo}</td>
                  <td>{q.orderValue}</td>
                  <td>{q.afterDiscountValue}</td>
                  <td>
                    <label className={`badge ${statusClass}`}
                    style={{fontSize: '14px'}}>{q.status}</label></td>
                    <td> <i
                        className="mdi mdi-printer menu-icon"
                        onClick={() => this.showOrderPDFWithOrg(q)}
                        style={{ fontSize: '24px', color: '#2196F3', cursor: 'pointer' }}
                      ></i></td>
                  
                </tr>
                );
              })}
                    {this.state.orders.length === 0 && (
                <tr><td colSpan="6" className="text-center">No orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  renderorderForm = () => {
    const { formData, overlayType, productOverlayVisible,breakdownItems,breakdownType } = this.state;
    const isFOB = formData.impExp === 'FOB';
      const itemTotals = (formData.lineItems || []).reduce((acc, li) => {
      acc[li.itemCode] = parseFloat(li.total || 0) || 0;
      return acc;
    }, {});
    const sumOfItemTotals = Object.values(itemTotals).reduce((sum, val) => sum + val, 0);


    return (
      <div>
        <div className="card full-height">
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <h4 className="mb-3">Order Form</h4>
            <ul className="nav nav-tabs" role="tablist">
              <li className="nav-item">
                <button type="button" className={`nav-link ${this.state.activeTab === 'co' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'co' })}>CO Details</button>
              </li>
              <li className="nav-item">
                <button type="button" className={`nav-link ${this.state.activeTab === 'commercial' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'commercial' })}>Commercial Terms</button>
              </li>
              <li className="nav-item">
              <button type="button" className={`nav-link ${this.state.activeTab === 'breakdown' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'breakdown' })}>Breakdown</button>
            </li>
            </ul>
            <form className="form-sample" onSubmit={this.handleSubmit}>
              <div className="tab-content pt-3">
                {this.state.activeTab === 'co' && (
                  <>
                    <div className="form-row">
                      <div className="form-group col-md-3">
                        <label>Order No</label>
                        <input type="text" className="form-control form-control-sm" value={formData.orderNo} onChange={(e) => this.handleInputChange('orderNo', e.target.value)} />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Order Date</label>
                        <input type="date" className="form-control form-control-sm" value={formData.orderDate} onChange={(e) => this.handleInputChange('orderDate', e.target.value)} />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Order Type</label>
                        <select className="form-control form-control-sm" value={formData.orderType} onChange={(e) => this.handleInputChange('orderType', e.target.value)}>
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
                          value={formData.totalTaxAmount}
                          onChange={(e) => this.handleInputChange('totalTaxAmount', e.target.value)}
                          readOnly={isFOB} // Read-only if FOB
                        />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Order Value</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={formData.orderValue}
                          onChange={(e) => this.handleInputChange('orderValue', e.target.value)}
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
                          this.handleInputChange('discountPercent', e.target.value);
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
                              + Add Product
                            </button>
                          </div>
                          <div className="table-responsive">
                            <table className="table table-bordered">
                              <thead className="thead-light">
                                <tr >
                                  <th> Item Code </th>
                                  <th> Item Desc </th>
                                  <th> Cust Part No </th>
                                  <th> HSN No </th>
                                  <th> On Hand </th> 
                                  <th>Unit Price</th>
                                  <th>Quantity</th>
                                  <th>Tax Id</th>
                                  <th>Item Total</th>
                                  <th>Tax amount</th>
                                  <th>Grand Total</th>
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
                                    <td style={{ verticalAlign: 'middle' }}>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={() => this.setState({ showTaxOverlay: true, currentTaxIdx: idx })}
                                      >
                                        Select Tax
                                      </button>
                                      <div style={{ fontSize: '10px', marginTop: '4px' }}>
                                        {(item.taxGroupNames || []).join(', ') || '-'}
                                      </div>
                                    </td>
                                    <td>{item.baseTotal || '0.00'}</td>
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
                          value={formData.taxAmount}
                          onChange={(e) => this.handleInputChange('freighttaxAmount', e.target.value)}
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
                    <div className="text-right mt-3">
                      <button type="submit" className="btn btn-success">Save All Details</button>
                    </div>
                  </>
                )}
                 {this.state.activeTab === 'breakdown' && (this.renderBreakdownTab())}
              </div>

             <div className="fixed-card-footer text-right p-3 border-top bg-white">
                <button
                  type="button"
                  className="btn btn-secondary mr-2"
                  onClick={() => this.setState({ showForm: false, editingId: null })}
                >
                  Cancel
                </button>
   <button type="submit" className="btn btn-success " disabled={!this.isBreakdownValid()}>Save All Details</button>

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

  render() {
    return (
      <div className="container-fluid">
        {this.state.previewOrderMode ? this.renderOrderPreview() : (this.state.showForm ? this.renderorderForm() : this.renderorderTable())}
      </div>
    );
  }
}

export default withRouter(Order);
