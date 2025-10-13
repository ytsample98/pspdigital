// src/app/sales/salestransactions/servicecontract/contractfinalbilling.js
import React, { Component } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { db } from "../../../../../firebase";
import {  collection,  getDocs,  addDoc,  updateDoc,  doc,serverTimestamp,} from "firebase/firestore";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { toWords } from 'number-to-words';



class ContractFinalBilling extends Component {
  state = {
    contracts: [],
    taxGroups: [],
    bills: [],
    showForm: false,
    editingId: null,
    activeTab: 0,
    showContractOverlay: false,
    contractOverlaySearch: "",
    formData: this.getEmptyForm(),
    notes: "",

  };

  getEmptyForm() {
    return{
      billType: "Standard",
      billNo: "",
      billDate: new Date().toISOString().split("T")[0],
      status: "Entered",
      refNo: "",
      contractId: "",
      contractNo: "",
      nameofwrk: "",
      customer: "",
      currency: "",
      conversionRate: "",
      amtAgreed: "",
    prorate: false,
    discountPercent: 0,
    discountAmount:'',
      durationFrom: "",
      durationTo: "",
      scheduleDate: "",
      taxAmt: "",
      billValue: "",
      billTo: "",
      shipTo: "",
      placeOfDelivery: "",
      despatchMode: "",
      paymentTerms: "",
      freightCharges: "",
      freightPercent: "",
      freightTaxAmt: "",
      packingCharges: "",
      lineItems: [],
    };
  }

  componentDidMount() {
  this.fetchContracts();
  this.fetchBills();
  this.fetchTaxGroups();
  this.autoGenerateBills();
}

  fetchContracts = async () => {
  const snap = await getDocs(collection(db, "contracts"));
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const filtered = data.filter(c => c.status === 'Approved' || c.status === 'Partial');
  this.setState({ contracts: filtered });
};

  fetchBills = async () => {
    const snap = await getDocs(collection(db, "finalBills"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ bills: data.reverse() });
  };

  fetchTaxGroups = async () => {
    const snap = await getDocs(collection(db, "taxGroups"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ taxGroups: data });
  };
autoGenerateBills = async () => {
  const today = new Date();
  const contractsSnap = await getDocs(collection(db, "contracts"));
  const contracts = contractsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.autoBill && c.status === "Approved");

  for (const contract of contracts) {
    let lastTo = new Date(contract.durationTo);
    let tillDate = contract.tillDate ? new Date(contract.tillDate) : null;
    let billingType = (contract.billingTypes && contract.billingTypes[0]) || 'yearly';
    let monthsPerCycle = billingType === 'yearly' ? 12 : billingType === 'half-yearly' ? 6 : 3;

    // Find last bill for this contract
    const billsSnap = await getDocs(collection(db, "finalBills"));
    const bills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(b => b.contractId === contract.id);

    let nextFrom = new Date(contract.durationFrom);
    if (bills.length > 0) {
      // Get last bill's durationTo
      const lastBill = bills.reduce((a, b) => new Date(a.durationTo) > new Date(b.durationTo) ? a : b);
      nextFrom = new Date(lastBill.durationTo);
      nextFrom.setDate(nextFrom.getDate() + 1);
    }

    // Generate bills until today < tillDate
    while (tillDate && nextFrom <= today && nextFrom <= tillDate) {
      let nextTo = new Date(nextFrom);
      nextTo.setMonth(nextTo.getMonth() + monthsPerCycle);
      nextTo.setDate(nextTo.getDate() - 1); // End of cycle

      // Check if bill already exists for this period
      const exists = bills.some(b => b.durationFrom === nextFrom.toISOString().split('T')[0] && b.durationTo === nextTo.toISOString().split('T')[0]);
      if (!exists) {
        // Create bill
        const billData = {
          billType: "Standard",
          billNo: `CB${Math.floor(Math.random() * 100000)}`,
          billDate: new Date().toISOString().split("T")[0],
          status: "Yet to Bill",
          contractId: contract.id,
          contractNo: contract.contractNo,
          nameofwrk: contract.nameofwrk,
          customer: contract.customer,
          currency: contract.currency,
          conversionRate: contract.conversionRate,
          amtAgreed: contract.amtAgreed,
          durationFrom: nextFrom.toISOString().split('T')[0],
          durationTo: nextTo.toISOString().split('T')[0],
          billTo: contract.billTo,
          shipTo: contract.shipTo,
          despatchMode: contract.despatchMode,
          paymentTerms: contract.paymentTerms,
          freightCharges: contract.freightCharges,
          freightPercent: contract.freightTaxPercent,
          freightTaxAmt: contract.freightTaxAmt,
          packingCharges: contract.packingCharges,
          lineItems: contract.lineItems.map(item => ({
            ...item,
            months: monthsPerCycle,
            days: 0,
            qty: item.qty,
            unitPrice: item.unitPrice,
            taxGroupNames: item.taxGroupNames,
            taxAmt: 0,
            itemTotal: 0
          })),
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, "finalBills"), billData);
      }
      // Prepare for next cycle
      nextFrom = new Date(nextTo);
      nextFrom.setDate(nextFrom.getDate() + 1);
    }
  }
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
  this.setState((prev) => ({
    formData: { ...prev.formData, [field]: value },
  }), () => {
    if (field === 'discountPercent') {
      const amtAgreed = parseFloat(this.state.formData.amtAgreed || 0);
      const discountPercent = parseFloat(this.state.formData.discountPercent || 0);
      const discountAmount = ((amtAgreed * discountPercent) / 100).toFixed(2);
      this.setState(prev => ({
        formData: { ...prev.formData, discountAmount }
      }), this.recalculateBillTotals);
    }
    if ([
      'freightCharges', 'freightPercent', 'packingCharges', 'conversionRate',
      'stdDays', 'amtAgreed', 'discountPercent'
    ].includes(field)) {
      this.recalculateBillTotals();
    }
  });
};
getRecvQtyMap = async (contractId) => {
  const snap = await getDocs(collection(db, "finalBills"));
  const approvedBills = snap.docs
    .map(doc => doc.data())
    .filter(bill => bill.contractId === contractId && bill.status === "Approved");
  const recvQtyMap = {};
  approvedBills.forEach(bill => {
    (bill.lineItems || []).forEach(item => {
      const code = item.itemCode;
      const qty = parseFloat(item.qty || 0);
      recvQtyMap[code] = (recvQtyMap[code] || 0) + qty;
    });
  });
  return recvQtyMap;
};
selectContract = async (contract) => {
  // Prepare line items from contract
  const lineItems = (contract.lineItems || []).map(li => ({
    itemCode: li.itemCode,
    itemDesc: li.itemDesc,
    hsnCode: li.hsnCode,
    uom: li.uom,
    duration: li.duration || `${contract.durationFrom} to ${contract.durationTo}`,
    qty: li.qty || '', // user can edit
    unitPrice: li.unitPrice || '',
    months: li.months || 1,
    taxGroupNames: li.taxGroupNames || [],
    taxAmt: 0,
    itemTotal: 0,
    days: '', // for prorate, user can edit
  }));

  this.setState(prev => ({
    formData: {
      ...prev.formData,
      contractId: contract.id,
      contractNo: contract.contractNo,
      nameofwrk: contract.nameofwrk || "",
      customer: contract.customer,
      currency: contract.currency,
      conversionRate: contract.conversionRate,
      amtAgreed: contract.amtAgreed,
      durationFrom: contract.durationFrom,
      durationTo: contract.durationTo,
      billTo: this.formatAddress(contract.billTo),
      shipTo: this.formatAddress(contract.shipTo),
      despatchMode: contract.despatchMode,
      paymentTerms: contract.paymentTerms,
      freightCharges: contract.freightCharges || "",
      freightPercent: contract.freightTaxPercent || "",
      freightTaxAmt: contract.freightTaxAmt || "",
      packingCharges: contract.packingCharges || "",
      lineItems,
    },
    showContractOverlay: false,
  }), this.recalculateBillTotals);
};
  handleInputChange = (field, value) => {
    this.setState((prev) => ({
      formData: { ...prev.formData, [field]: value },
    }), () => {
      if ([
        'freightCharges', 'freightPercent', 'packingCharges', 'conversionRate',
        'stdDays', 'amtAgreed'
      ].includes(field)) {
        this.recalculateBillTotals();
      }
    });
  };

handleLineItemChange = (idx, field, value) => {
  const items = [...this.state.formData.lineItems];
  items[idx] = { ...items[idx], [field]: value };
  // Calculation
  const qty = parseFloat(items[idx].qty || 0);
  const unitPrice = parseFloat(items[idx].unitPrice || 0);
  const months = parseFloat(items[idx].months || 1);
  const days = parseFloat(items[idx].days || 0);
  let totalMonths = months;
  if (days > 0) {
    let daysInMonth = 30;
    const { durationFrom } = this.state.formData;
    if (durationFrom) {
      const d = new Date(durationFrom);
      daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }
    totalMonths = (months) + (days / daysInMonth);
  }
  const baseTotal = qty * unitPrice * totalMonths;
  items[idx].itemTotal = baseTotal.toFixed(2);
  this.setState((prev) => ({
    formData: { ...prev.formData, lineItems: items },
  }), this.recalculateBillTotals);
};

recalculateBillTotals = () => {
  const { lineItems, freightCharges, freightPercent, packingCharges, conversionRate, discountAmount } = this.state.formData;
  let billValue = 0;
  let taxAmt = 0;
  (lineItems || []).forEach(item => {
    billValue += parseFloat(item.itemTotal || 0);
    taxAmt += parseFloat(item.taxAmt || 0);
  });
  const freightTaxAmt = (parseFloat(freightCharges || 0) * parseFloat(freightPercent || 0)) / 100;
  billValue += parseFloat(freightCharges || 0) + parseFloat(packingCharges || 0) + freightTaxAmt;

  // Apply discount
  billValue -= parseFloat(discountAmount || 0);

  // Apply conversion rate if needed
  let finalValue = billValue;
  if (conversionRate) {
    finalValue = billValue * parseFloat(conversionRate);
  }

  this.setState(prev => ({
    formData: {
      ...prev.formData,
      billValue: finalValue.toFixed(2),
      taxAmt: taxAmt.toFixed(2),
      freightTaxAmt: freightTaxAmt.toFixed(2)
    }
  }));
};

  handleTabChange = (i) => this.setState({ activeTab: i });
handleSubmit = async (e) => {
  e.preventDefault();
  this.setState({ loading: true, error: null });
  try {
    const { editingId, formData, bills } = this.state;
    const saveData = {
      ...formData,
      notes: this.state.notes,
      createdAt: serverTimestamp(),
      status: "Awaiting For Approval"
    };
    if (editingId) {
      await updateDoc(doc(db, "finalBills", editingId), saveData);
    } else {
      saveData.billNo = `CB${1000 + bills.length}`;
      await addDoc(collection(db, "finalBills"), saveData);
      
    }
    await this.fetchBills(); // Ensure bills are refreshed before hiding form
    this.setState({
      showForm: false,
      editingId: null,
      formData: this.getEmptyForm(),
      notes: "",
      loading: false,
    });
  } catch (err) {
    this.setState({ error: err.message, loading: false });
    alert("Error saving bill: " + err.message);
  }
};

showContractBillingPDFWithOrg = async (bill) => {
  // 1. Fetch org and customer data
  const orgSnap = await getDocs(collection(db, 'businessGroups'));
  const org = orgSnap.docs[0]?.data() || {};
  const customerSnap = await getDocs(collection(db, 'customers'));
  const customers = customerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const customer = customers.find(
    c => c.custname === bill.customer || c.custcode === bill.customer
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
// In showContractBillingPDFWithOrg
const enrichedItems = (bill.lineItems || []).filter(item => parseFloat(item.qty || 0) > 0).map(item => ({
  ...item,
  hsnCode: item.hsnCode || '',
  uom: item.uom || '',
  itemDesc: item.itemDesc || '',
  taxGroupNames: item.taxGroupNames || (item.taxGroupName ? item.taxGroupName.split(',').map(s => s.trim()) : [])
}));

  // 3. Totals
  const subtotal = enrichedItems.reduce((sum, item) =>
    sum + ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.billQty) || 0) * (parseFloat(item.unitDayOrWk) || 1) * (parseFloat(item.months) || 1) * (parseFloat(bill.stdDays) || 30)), 0
  );
  const freightCharges = parseFloat(bill.freightCharges || 0);
  const packingCharges = parseFloat(bill.packingCharges || 0);
  const freightTax = parseFloat(bill.freightTaxAmt || 0);
  const totalTaxAmount = parseFloat(bill.taxAmt || 0);
  const billValue = parseFloat(bill.billValue || (subtotal + totalTaxAmount + freightCharges + packingCharges));
  const amountWords = `INR ${toWords(Math.floor(billValue))} Only`;

  // 4. Tax breakdown
  let taxBreakdown = {};
  let taxGroupDetails = [];
  let sno = 1;
  enrichedItems.forEach(item => {
    const qty = parseFloat(item.billQty || 0);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const months = parseFloat(item.months || 1);
    const unitDayOrWk = parseFloat(item.unitDayOrWk || 1);
    const stdDays = parseFloat(bill.stdDays || 30);
    const base = qty * unitPrice * months * unitDayOrWk * stdDays;
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
      <div style="font-size:18px; font-weight:bold;">CONTRACT BILLING INVOICE</div>
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
        <tr><td><b>Bill No</b></td><td>: ${bill.billNo || ''}</td></tr>
        <tr><td><b>Bill Date</b></td><td>: ${bill.billDate || ''}</td></tr>
        <tr><td><b>Due Date</b></td><td>: ${bill.scheduleDate || ''}</td></tr>
        <tr><td><b>Customer</b></td><td>: ${bill.customer || ''}</td></tr>
        <tr><td><b>Currency</b></td><td>: ${bill.currency || 'INR'}</td></tr>
      </table>
    </div>

    <div style="margin-top:15px; display:flex; justify-content:space-between; font-size:11px;">
      <div style="width:48%;">
        <b style="background:#011b56; color:#fff; display:block; padding:4px;">Bill To</b>
        <div style="border:1px solid #ccc; padding:6px;">
         <b>${bill.customer || ''}</b><br/>
          ${(bill.billTo || '').replace(/\n/g, '<br/>')}
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
         <b>${bill.customer || ''}</b><br/>
          ${(bill.shipTo || '').replace(/\n/g, '<br/>')}
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
          <th style="border:1px solid #011b56;">HSN/SAC</th>
          <th style="border:1px solid #011b56;">UOM</th>
          <th style="border:1px solid #011b56;">Qty</th>
          <th style="border:1px solid #011b56;">Unit Price</th>
          <th style="border:1px solid #011b56;">Months</th>
          <th style="border:1px solid #011b56;">Tax Group</th>
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
              <td style="border:1px solid #011b56;">${item.itemDesc || ''}</td>
              <td style="border:1px solid #011b56;">${item.hsnCode}</td>
              <td style="border:1px solid #011b56;">${item.uom}</td>
              <td style="border:1px solid #011b56;">${item.billQty}</td>
              <td style="border:1px solid #011b56;">${item.unitPrice}</td>
              <td style="border:1px solid #011b56;">${item.months}</td>
<td style="border:1px solid #011b56;">${gstLabel}</td>
              <td style="border:1px solid #011b56;">${item.itemTotal}</td>
            </tr>`;
        }).join('')}
        <tr>
          <td colspan="9" style="text-align:right; border:1px solid #011b56;"><b>Subtotal</b></td>
          <td style="border:1px solid #011b56;"><b>${subtotal.toFixed(2)}</b></td>
        </tr>
        <tr>
          <td colspan="9" style="text-align:right; border:1px solid #011b56;"><b>Total Tax Amount</b></td>
          <td style="border:1px solid #011b56;"><b>${totalTaxAmount.toFixed(2)}</b></td>
        </tr>
        <tr>
          <td colspan="9" style="text-align:right; border:1px solid #011b56;"><b>Bill Value</b></td>
          <td style="border:1px solid #011b56;"><b>${billValue.toFixed(2)}</b></td>
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
    <html><head><title>Contract Billing PDF Preview</title></head>
    <body style="margin:0;">
      <iframe width="100%" height="100%" style="border:none;" src="${url}"></iframe>
    </body></html>
  `);
  newWin.document.close();
};

  renderBillingDetailsTab = () => {
    const f = this.state.formData;
    return (
      <div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Bill Type</label>
            <select
              className="form-control"
              value={f.billType}
              onChange={(e) => this.handleInputChange("billType", e.target.value)}
            >
              <option value="Standard">Standard</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
          <div className="form-group col-md-2">
            <label>Bill No</label>
            <input
              className="form-control"
              value={f.billNo}
              readOnly
              placeholder="Auto"
            />
          </div>
          <div className="form-group col-md-3">
            <label>Bill Date</label>
            <input
              type="date"
              className="form-control"
              value={f.billDate}
              onChange={(e) => this.handleInputChange("billDate", e.target.value)}
            />
          </div>
          <div className="form-group col-md-3">
            <label>Status</label>
            <input className="form-control" value={f.status} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Ref No</label>
            <input
              className="form-control"
              value={f.refNo}
              onChange={(e) => this.handleInputChange("refNo", e.target.value)}
            />
          </div>
          
        </div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Contract</label>
            <input
              className="form-control"
              placeholder="Select Contract"
              value={f.contractNo}
              readOnly
              onClick={() => this.setState({ showContractOverlay: true })}
            />
          </div>
          
          <div className="form-group col-md-2">
            <label>Currency</label>
            <input className="form-control" value={f.currency} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Conversion Rate</label>
            <input type="number" className="form-control" value={f.conversionRate} onChange={e => this.handleInputChange("conversionRate", e.target.value)} />
          </div>
          <div className="form-group col-md-2">
            <label>Name of Work</label>
            <input className="form-control" value={f.nameofwrk} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Change Inv Unit Price</label>
            <input type="checkbox" checked={f.changeInvUnitPrice} onChange={e => this.handleInputChange("changeInvUnitPrice", e.target.checked)} />
          </div>
          
        </div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Amt Agreed</label>
            <input className="form-control" value={f.amtAgreed} readOnly />
          </div>
          <div className="form-group col-md-3">
            <label>Duration From</label>
            <input type="date" className="form-control" value={f.durationFrom} readOnly />
          </div>
          <div className="form-group col-md-3">
            <label>Duration To</label>
            <input type="date" className="form-control" value={f.durationTo} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Schedule Date</label>
            <input className="form-control" type="date" value={f.scheduleDate} onChange={e => this.handleInputChange("scheduleDate", e.target.value)} />
          </div>
          <div className="form-group col-mb-2">
            <label>Repeat</label>
            <input type="checkbox" checked={f.repeat} onChange={e => this.handleInputChange("repeat", e.target.checked)} />
          </div>
          </div>
          <div className="form-row">
          <div className="form-group col-md-2">
            <label>Tax Amount (INR)</label>
            <input className="form-control" value={f.taxAmt} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Bill Value (INR)</label>
            <input className="form-control" value={f.billValue} readOnly />
          </div>
  <div className="form-group col-md-2">
    <label>Prorate</label>
    <input
      type="checkbox"
      checked={this.state.formData.prorate}
      onChange={e => this.handleInputChange("prorate", e.target.checked)}
    />
  </div>
  <div className="form-group col-md-2">
    <label>Discount (%)</label>
    <input
      type="number"
      className="form-control"
      value={this.state.formData.discountPercent}
      onChange={e => this.handleInputChange("discountPercent", e.target.value)}
    />
  </div>
  <div className="form-group col-md-2">
    <label>Discount Amount</label>
    <input
      type="number"
      className="form-control"
      value={this.state.formData.discountAmount}
      readOnly
    />
  </div>
</div>
        </div>
    );
  };

  renderTermsTab = () => {
    const f = this.state.formData;
    return (
      <div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Bill To</label>
            <textarea className="form-control" value={f.billTo} readOnly />
          </div>
          <div className="form-group col-md-6">
            <label>Ship To</label>
            <textarea className="form-control" value={f.shipTo} readOnly />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-4">
            <label>Place Of Delivery</label>
            <input className="form-control" value={f.placeOfDelivery} onChange={e => this.handleInputChange("placeOfDelivery", e.target.value)} />
          </div>
          <div className="form-group col-md-4">
            <label>Despatch Mode</label>
            <input className="form-control" value={f.despatchMode} readOnly />
          </div>
          <div className="form-group col-md-4">
            <label>Payment Terms</label>
            <input className="form-control" value={f.paymentTerms} readOnly />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-3">
            <label>Freight Charges (INR)</label>
            <input className="form-control" value={f.freightCharges} onChange={e => this.handleInputChange("freightCharges", e.target.value)} />
          </div>
          <div className="form-group col-md-3">
            <label>Freight %</label>
            <input className="form-control" value={f.freightPercent} onChange={e => this.handleInputChange("freightPercent", e.target.value)} />
          </div>
          <div className="form-group col-md-3">
            <label>Freight Tax Amount (INR)</label>
            <input className="form-control" value={f.freightTaxAmt} readOnly />
          </div>
          <div className="form-group col-md-3">
            <label>Packing Charges (INR)</label>
            <input className="form-control" value={f.packingCharges} onChange={e => this.handleInputChange("packingCharges", e.target.value)} />
          </div>
        </div>
      </div>
    );
  };

renderLineItems = () => {
  const items = this.state.formData.lineItems || [];
  const isINR = (this.state.formData.currency || 'INR') === 'INR';
  const showProrate = this.state.formData.prorate;

  // Calculate days in month from duration
  let daysInMonth = 30;
  const { durationFrom, durationTo } = this.state.formData;
  if (durationFrom && durationTo) {
    const from = new Date(durationFrom);
    const to = new Date(durationTo);
    daysInMonth = Math.max(1, (to - from) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered" style={{minWidth: '800px'}}>
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Item Desc</th>
            <th>Qty</th>
            <th>Unit Price</th>
            {showProrate && <th>Days</th>}
            <th>Months</th>
            {isINR && <th>Tax Group</th>}
            <th>Tax Amount</th>
            <th>Item Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>{it.itemCode}</td>
              <td>{it.itemDesc}</td>
              <td>
                <input
                  type="number"
                  className="form-control"
                  value={it.qty}
                  onChange={e => this.handleLineItemChange(i, "qty", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="form-control"
                  value={it.unitPrice}
                  onChange={e => this.handleLineItemChange(i, "unitPrice", e.target.value)}
                />
              </td>
              <td>
  <input
    type="number"
    className="form-control"
    value={it.days || ''}
    onChange={e => this.handleLineItemChange(i, "days", e.target.value)}
  />
</td>
<td>
  <input
    type="number"
    className="form-control"
    value={it.months}
    onChange={e => this.handleLineItemChange(i, "months", e.target.value)}
  />
</td>
              {isINR && (
                <td>
                  <select
                    className="form-control"
                    value={it.taxGroupNames?.[0] || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const arr = val ? [val] : [];
                      this.handleLineItemChange(i, "taxGroupNames", arr);
                    }}
                  >
                    <option value="">-Select-</option>
                    {this.state.taxGroups.map((tg, idx) => (
                      <option key={idx} value={tg.groupName}>{tg.groupName}</option>
                    ))}
                  </select>
                </td>
              )}
              <td>{it.taxAmt}</td>
              <td>{it.itemTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

  renderTabs = () => {
    const tabs = ["Billing Details", "Port & Terms", "Notes"];
    return (
      <ul className="nav nav-tabs mb-3">
        {tabs.map((t, i) => (
          <li key={i} className="nav-item">
            <button
              type="button"
              className={`nav-link ${this.state.activeTab === i ? "active" : ""}`}
              onClick={() => this.handleTabChange(i)}
            >
              {t}
            </button>
          </li>
        ))}
      </ul>
    );
  };
renderNotesTab = () => (
  <div>
    <div className="form-group">
      <label>Notes / Remarks</label>
      <textarea
        className="form-control form-control-sm"
        rows={2}
        value={this.state.notes}
        onChange={e => this.setState({ notes: e.target.value })}
        style={{ resize: "vertical", minHeight: "40px", maxHeight: "120px" }}
      />
    </div>
  </div>
);
  renderForm = () => {
    return (
      <div className="card full-height">
        <form onSubmit={this.handleSubmit}>
          <div className="card-body">
            {this.renderTabs()}
            {this.state.activeTab === 0 && (
              <>
                {this.renderBillingDetailsTab()}
                {this.renderLineItems()}
              </>
            )}
            {this.state.activeTab === 1 && this.renderTermsTab()}
            {this.state.activeTab === 2 && this.renderNotesTab()}
          </div>
              <div className="fixed-card-footer text-right p-3 border-top bg-white">
            
            <button
              className="btn btn-secondary ml-2"
              type="button"
              onClick={() =>
                this.setState({
                  showForm: false,
                  editingId: null,
                  formData: this.getEmptyForm(),
                  notes: "",
                })
              }
            >
              Cancel
            </button>
            <button className="btn btn-success" type="submit">
              {this.state.editingId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Contract Billing</h4>
          <button className="btn btn-primary" onClick={() => this.setState({ showForm: true })}>Create</button>
        </div>
              <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
            <tr>
              <th>Bill No</th>
              <th>Date</th>
              <th>Contract</th>
              <th>Customer</th>
              <th>Currency</th>
              <th>Bill Value</th>
              <th>Status</th>
              <th>Print</th>
            </tr>
          </thead>
          <tbody>
  {this.state.bills.map((b, i) => {
    let statusClass = "badge-secondary";
    if (b.status === "Entered") statusClass = "badge-warning";
    else if (b.status === "Yet to Bill") statusClass = "badge-info";
    else if (b.status === "Cancelled") statusClass = "badge-danger";
    else if (b.status === "Approved") statusClass = "badge-success"; 

    return (
      <tr key={i}>
        <td>
          <button
            className="btn btn-link"
            onClick={() =>
              this.setState({
                showForm: true,
                editingId: b.id,
                formData: { ...b },
                notes: b.notes || "",
              })
            }
          >
            {b.billNo}
          </button>
        </td>
        <td>{b.billDate}</td>
        <td>{b.contractNo}</td>
        <td>{b.customer}</td>
        <td>{b.currency}</td>
        <td>{b.billValue}</td>
        <td>
          <label className={`badge ${statusClass}`} style={{ fontSize: "14px" }}>
            {b.status}
          </label>
        </td>
        <td>
          <i
            className="mdi mdi-printer menu-icon"
            onClick={() => this.showContractBillingPDFWithOrg(b)}
            style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }}
          />
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

  renderContractOverlay = () => {
    const { contracts, contractOverlaySearch } = this.state;
    const filtered = contracts.filter((c) =>
      (c.contractNo || "")
        .toLowerCase()
        .includes(contractOverlaySearch.toLowerCase())
    );
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <h5>Select Contract</h5>
          <input
            className="form-control mb-2"
            value={contractOverlaySearch}
            onChange={(e) =>
              this.setState({ contractOverlaySearch: e.target.value })
            }
          />
          <table className="table table-sm table-bordered">
            <thead>
              <tr>
                <th>Contract No</th>
                <th>Customer</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => this.selectContract(c)}
                >
                  <td>{c.contractNo}</td>
                  <td>{c.customer}</td>
                  <td>{c.contractValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => this.setState({ showContractOverlay: false })}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  render() {
    return (
      <div className="container-fluid">
        {this.state.showForm ? this.renderForm() : this.renderTable()}
        {this.state.showContractOverlay && this.renderContractOverlay()}
      </div>
    );
  }
}

export default ContractFinalBilling;
