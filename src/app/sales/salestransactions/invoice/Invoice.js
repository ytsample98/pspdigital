import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import bsCustomFileInput from 'bs-custom-file-input';
import { db } from '../../../../firebase';
import { collection, getDocs, addDoc, doc, updateDoc ,serverTimestamp} from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf'; 
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

class inv extends Component {
  state = {
    activeTab: 'co',
    invoices: [],
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
  const total = baseTotal + taxAmt;

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

handleConvertToInvoice = () => {
  const { formData } = this.state;

  const invoiceData = {
    invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceType: 'Standard',
    customer: formData.customer || '',
    status: 'Entered',
    choose: formData.choose || 'Service',
    qrefNo: formData.qrefNo || '',
    impExp: formData.impExp || 'None',
    currency: formData.currency || '',
    conversionRate: formData.conversionRate || '',
    taxAmount: formData.taxAmount || '',
    invoiceValue: formData.invoiceValue || '',
    billTo: formData.billTo || '',
    shipTo: formData.shipTo || '',
    despatchMode: formData.despatchMode || '',
    paymentTerms: formData.paymentTerms || '',
    freightCharges: formData.freightCharges || '',
    freighttaxAmount: formData.freighttaxAmount || '',
    taxPercent: formData.taxPercent || '',
    packingCharges: formData.packingCharges || '',
    discountPercent: formData.discountPercent || 0,
    discountAmount: formData.discountAmount || 0,
    afterDiscountValue: formData.afterDiscountValue || 0,
    lineItems: (formData.lineItems || []).map(item => ({
      itemCode: item.itemCode || '',
      ptshortName: item.ptshortName || '',
      itemDescription: item.itemDescription || '',
      hsnCode: item.hsnCode || '',
      uom: item.uom || '',
      qty: item.qty || 1,
      unitPrice: item.unitPrice || 0,
      taxGroupNames: item.taxGroupNames || [],
      taxAmt: item.taxAmt || 0,
      total: item.total || (parseFloat(item.qty || 1) * parseFloat(item.unitPrice || 0)).toFixed(2),
    })),
  };

  this.props.history.push({
    pathname: '/panelone/Invoice',
    state: { invoiceDataFromOrder: invoiceData },
  });
};



componentDidMount() {
  bsCustomFileInput.init();
  this.fetchinvoice();
  this.fetchCustomers();
  this.fetchProducts();
  this.fetchDespatchModes();
  this.fetchPaymentTerms();
  this.fetchTaxGroups();

const sessionData = sessionStorage.getItem('invoiceDataFromOrder');
const locationData = this.props.location?.state?.invoiceDataFromOrder;

if (locationData || sessionData) {
  const invoiceData = locationData || JSON.parse(sessionData);
  this.setState({
    formData: { ...this.getEmptyInvoiceForm(), ...(invoiceData || {}) },
    showForm: true,
    editingId: null,
  });
  sessionStorage.removeItem('invoiceDataFromOrder');
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
        const total = parseFloat(item.total) || 0;
        return sum + total;
      }, 0);

      const invoiceValue = lineTotal + freight + taxAmount + packing;

      if (
    this.state.formData.taxAmount !== taxAmount.toFixed(2) ||
    this.state.formData.invoiceValue !== invoiceValue.toFixed(2)
  ) {
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        taxAmount: taxAmount.toFixed(2),
        invoiceValue: invoiceValue.toFixed(2)
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
        invoiceValue: ''
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
    this.setState({ products: data });
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
    }));
  };
  
handleLineItemChange = (idx, field, value) => {
  const updatedItems = [...this.state.formData.lineItems];
  updatedItems[idx] = { ...updatedItems[idx], [field]: value };
  const { updatedLineItems, freighttaxAmount, taxAmount, quoteValue } = recalculateTotals({
    lineItems: updatedItems,
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
      status: "Entered",
      updatedAt: serverTimestamp()
    });
  } else {
    formData.invoiceNo = `INV${1000 + invoices.length}`;
    await addDoc(collection(db, "invoices"), {
      ...formData,
      status: "Entered",
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

  loadinvoiceForEdit = (invoice) => {
  this.setState({
    formData: {
      ...invoice,
      lineItems: Array.isArray(invoice.lineItems) ? invoice.lineItems : [] // Ensure array
    },
    editingId: invoice.id,
    showForm: true,
    activeTab: 'co'
  }, () => {
    if (this.customerInputRef.current) {
      this.customerInputRef.current.value = invoice.customer;
    }
  });
};
toggleInvoiceForm = () => {
  this.setState({
    showForm: true,
    editingId: null,
    formData: this.getEmptyInvoiceForm(),
  });
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

  this.setState({ formData }, () => this.calculateinvoiceTotals());
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
      position: 'fixed', zIndex: 1000, top: '10%', left: '15%',
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
        <button className="btn btn-sm btn-success" onClick={() => this.setState({ showTaxOverlay: false })}>
          Done
        </button>
      </div>
    </div>
  );
};

  renderProductOverlay = () => {
    const { products, productOverlaySearch, selectedProductIds } = this.state;
    const filtered = products.filter(p =>
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
                const selectedProducts = products.filter(p => this.state.selectedProductIds.includes(p.id));
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
                          total: (p.unitPrice || 0).toFixed(2)
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
          {/* Add pagination here if needed, for now, it's just a placeholder */}
          <div className="d-flex justify-content-between align-items-center mt-2">
            <span>Page 1 of 1</span>
            <button className="btn btn-secondary btn-sm" onClick={() => this.setState({ productOverlayVisible: false, selectedProductIds: [] })}>Cancel</button>
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
          <button className="btn btn-primary" onClick={() => this.setState({ showForm: true })}>+ Add Invoice</button>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr style={{ fontSize: '14px' }}>
                <th>Invoice No</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Invoice Value</th>
                <th>After Discount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {this.state.invoices.map((q, i) =>  {
                let statusClass = "badge-secondary";
                if (q.status === "Entered") statusClass = "badge-warning";
                else if (q.status === "Submitted") statusClass = "badge-info";
                else if (q.status === "ConvertedToOrder") statusClass = "badge-success";
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
                 
                </tr>
                );
})}
              {this.state.invoices.length === 0 && (
                <tr><td colSpan="6" className="text-center">No invoices found.</td></tr>
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
            <h4 className="mb-3">Invoice Form</h4>
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
                        <label>invoice No</label>
                        <input type="text" className="form-control form-control-sm" value={formData.invoiceNo} onChange={(e) => this.handleInputChange('invoiceNo', e.target.value)} />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Invoice Date</label>
                        <input type="date" className="form-control form-control-sm" value={formData.invoiceDate} onChange={(e) => this.handleInputChange('invoiceDate', e.target.value)} />
                      </div>
                      <div className="form-group col-md-3">
                        <label>Invoice Type</label>
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
                            <input type="radio" className="form-check-input" name="choose" id="chooseService" value="Service" checked={formData.choose === 'Service'} onChange={(e) => this.handleInputChange('choose', e.target.value)} />
                            <label className="form-check-label" htmlFor="chooseService">Service</label>
                          </div>
                          <div className="form-check">
                            <input type="radio" className="form-check-input" name="choose" id="chooseProduct" value="Product" checked={formData.choose === 'Product'} onChange={(e) => this.handleInputChange('choose', e.target.value)} />
                            <label className="form-check-label" htmlFor="chooseProduct">Product</label>
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
                        <label>Invoice Value</label>
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
                        className="form-control"
                        value={this.state.formData.discountPercent}
                        onChange={e => this.handleDiscountChange("discountPercent", e.target.value)}
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
                                  <th>Tax Amt</th>
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
                                      <td>{item.taxAmount || '0.00'}</td>
                                      <td>{item.total || '0.00'}</td>
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

export default withRouter(inv);

