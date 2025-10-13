import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { db } from '../../../../firebase';
import { Modal, Button } from 'react-bootstrap';
import { collection, query, where,getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';  
class ContractBilling extends Component {
  
  state = {
    contracts: [],
    customers: [],
    products: [],
    taxGroups: [],
    users: [],
    isOneYear: '',
    showTaxOverlay: false,
    activeTab: 0,
    showForm: false,
    editingId: null,
    durationFrom: null,
    durationTo: null,
    billingTypes: [],
    autobill: false,
    paymentModes:[],
    tillDate: '', 
    repeat: false, 
    canAddItems: false,
    showProductOverlay: false,
    productOverlaySearch: '',
    selectedProductIds:[],
    formData: this.getEmptyContractForm(),
    notes: '',
    searchTerm:'',
    nameofwrk:'',
    showCustomerOrderOverlay: false,
    customerOrderOverlaySearch: '',
    selectedCustomerOrders: [],
    customerOrders: [],
    customerOrderLineItems: [],
    showAlert: false,
    alertMsg: '',
  };

  getEmptyContractForm() {
    return {
      contractType: 'Standard',
      contractNo: '',
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Entered',
      refNo: '',
      customer: '',
      currency: '',
      conversionRate: '',
      amtAgreed: '',
      nameofwrk:'',
      durationFrom: '',
      durationTo: '',
      lineItems: [],
      despatchMode: '',
      paymentTerms: '',
      billTo: '',
      shipTo: '',
      freightCharges: '',
      freightTaxPercent: '',
      freightTaxAmt: '',
      packingCharges: '',
      amountLimit: '',
      minimumRelease: '',
      contractValue: '',
      notes: ''
    };
  }

  componentDidMount() {
    this.fetchContracts();
    this.fetchCustomers();
    this.fetchProducts();
    this.fetchTaxGroups();
    this.fetchUsers();
  }
  componentDidUpdate(prevProps, prevState) {
  if (
    prevState.paymentMode !== this.state.paymentMode ||
    prevState.autoBill !== this.state.autoBill
  ) {
    if (this.state.autoBill) {
      this.updateLineItemsForAutoBill();
    }
  }
}

  fetchContracts = async () => {
    const snap = await getDocs(collection(db, 'contracts'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ contracts: data.reverse() });
  };

  fetchCustomers = async () => {
    const snap = await getDocs(collection(db, 'customers'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ customers: data });
  };
fetchCustomerOrders = async (customerName) => {
  if (!customerName) return this.setState({ customerOrders: [] });
  const snap = await getDocs(collection(db, 'orders'));
  const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const filtered = orders.filter(
    o => (o.customer === customerName || o.customerName === customerName) && o.status === "Approved"
  );
  this.setState({ customerOrders: filtered });
};

  fetchProducts = async () => {
    const snap = await getDocs(collection(db, 'products'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ products: data });
  };
fetchUsers = async () => {
  const snap = await getDocs(collection(db, 'users'));
  const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  this.setState({ users: data });
};
  fetchTaxGroups = async () => {
    const snap = await getDocs(collection(db, 'taxGroups'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ taxGroups: data });
  };
  
  checkDurationSelected = () => {
  const { durationFrom, durationTo } = this.state;
  this.setState({ canAddItems: !!(durationFrom && durationTo) });
};


  showProductOverlay = () => this.setState({ showProductOverlay: true, productOverlaySearch: '', selectedProductIds: [] });
  hideProductOverlay = () => this.setState({ showProductOverlay: false, productOverlaySearch: '', selectedProductIds: [] });

toggleProductSelection = (productId, checked) => {
  this.setState(prev => ({
    selectedProductIds: checked
      ? [...prev.selectedProductIds, productId]
      : prev.selectedProductIds.filter(id => id !== productId)
  }));
};
addSelectedProductsToLineItems = () => {
  const selectedProducts = this.state.products.filter(p => this.state.selectedProductIds.includes(p.id));
  const newItems = selectedProducts.map(product => ({
    itemCode: product.productId || '',
    itemDesc: product.ptdescription || '',
    hsnCode: product.hsnCode || '',
    qty: 1,
    unitPrice: product.price || 0,
    months: 1,
    taxGroupNames: [],
    taxAmt: 0,
    itemTotal: 0
  }));
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      lineItems: [...prev.formData.lineItems, ...newItems]
    },
    showProductOverlay: false,
    selectedProductIds: []
  }), this.recalculateContractTotals);
};

getDurationInfo = () => {
  const { durationFrom, durationTo } = this.state.formData;
  if (!durationFrom || !durationTo) return { months: 0, days: 0, billingType: '' };
  const from = new Date(durationFrom);
  const to = new Date(durationTo);
  // Months difference
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  // Days difference
  let days = (to - from) / (1000 * 60 * 60 * 24) + 1;
  // Billing type
  let billingType = '';
  if (months >= 12) billingType = 'yearly';
  else if (months === 6) billingType = 'half-yearly';
  else if (months <= 3) billingType = 'quarterly';
  return { months, days, billingType };
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

formatDate = (d) => {
  if (!d) return '';
  try {
    return format(new Date(d), 'dd-MMM-yy');
  } catch {
    return d;
  }
};

  selectCustomer = (customer) => {
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      customer: customer.custname,
      currency: customer.currency || '',
      billTo: this.formatAddress(customer.billTo),
      shipTo: this.formatAddress(customer.shipTo),
      despatchMode: customer.despatchMode || '',
      paymentTerms: customer.paymentTerms || '',
      customerOrderId: '',
      lineItems: [] 
    },
    showCustomerOverlay: false,
    customerOrderLineItems: [],
    customerOrders: []
  }), () => {
    this.fetchCustomerOrders(customer.custname); 
  });
};

selectCustomerOrder = (order) => {
  const lineItems = (order.lineItems || []).map(item => ({
    itemCode: item.itemCode || '',
    itemDesc: item.itemDescription || '',
    hsnCode: item.hsnCode || '',
    uom: item.uom || '',
    qty: item.qty || 1,
    unitPrice: item.unitPrice || 0,
    months: 1,
    taxGroupNames: [],
    taxAmt: 0,
    itemTotal: 0
  }));
  this.setState(prev => ({
    formData: {
      ...prev.formData,
      customerOrderId: order.orderNo,
      lineItems,
    },
    showCustomerOrderOverlay: false,
    customerOrderLineItems: lineItems,
  }), this.recalculateContractTotals);
};

  selectProductForLineItem = (product) => {
    const newItem = {
      itemCode: product.code || '',
      itemDesc: product.name || '',
      hsnCode: product.hsn || '',
      uom: product.uom || '',
      qty: 1,
      unitPrice: product.price || 0,
      months: 1,
      taxGroupNames: [],
      taxAmt: 0,
      itemTotal: 0
    };
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        lineItems: [...prev.formData.lineItems, newItem]
      },
      showProductOverlay: false
    }), this.recalculateContractTotals);
  };

handleInputChange = (field, value) => {
  this.setState(prev => ({
    formData: { ...prev.formData, [field]: value }
  }), () => {
    if (field === 'durationFrom' || field === 'durationTo') {
      const { billingType } = this.getDurationInfo();
      this.setState({ billingType });
    }
    if (['freightCharges', 'freightTaxPercent', 'packingCharges', 'amtAgreed', 'conversionRate'].includes(field)) {
      this.recalculateContractTotals();
    }
  });
};

handleAddItemsClick = () => {
  const { formData } = this.state;
  if (!formData.customer) {
    this.setState({ showAlert: true, alertMsg: "Select customer first!" });
    return;
  }
  if (!formData.durationFrom || !formData.durationTo) {
    this.setState({ showAlert: true, alertMsg: "Select contract duration first!" });
    return;
  }
  if (!formData.customerOrderId) {
    // Filter products for Bundle category
    const bundleProducts = this.state.products.filter(p => p.category === "Bundle");
    this.setState({ filteredProducts: bundleProducts, showProductOverlay: true });
  } else {
    this.setState({ showAlert: true, alertMsg: "Line items are already filled from selected order." });
  }
};

handleLineItemChange = (idx, field, value) => {
  const updatedItems = [...this.state.formData.lineItems];
  updatedItems[idx] = { ...updatedItems[idx], [field]: value };
  // Calculation
  const qty = parseFloat(updatedItems[idx].qty || 0);
  const unitPrice = parseFloat(updatedItems[idx].unitPrice || 0);
  const months = parseFloat(updatedItems[idx].months || 1);
  const days = parseFloat(updatedItems[idx].days || 0);
  let totalMonths = months;
  if (this.state.paymentModes.includes('prorate') && days > 0) {
    // Use correct proration formula
    let daysInMonth = 30;
    const { durationFrom } = this.state.formData;
    if (durationFrom) {
      const d = new Date(durationFrom);
      daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }
    totalMonths = (months) + (days / daysInMonth);
  }
  const baseTotal = qty * unitPrice * totalMonths;
  updatedItems[idx].itemTotal = baseTotal.toFixed(2);
  this.setState(prev => ({
    formData: { ...prev.formData, lineItems: updatedItems }
  }), this.recalculateContractTotals);
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
    const qty = parseFloat(item.qty || 0);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const months = parseFloat(item.months || 1);
    const baseTotal = qty * unitPrice * months;
    const taxAmt = ((baseTotal * percent) / 100 + amount);
    item.taxAmt = taxAmt.toFixed(2);
    item.itemTotal = (baseTotal + taxAmt).toFixed(2);
    item.baseTotal = baseTotal.toFixed(2);
    this.setState({ formData }, this.recalculateContractTotals);
  };

recalculateContractTotals = () => {
    const { lineItems, freightCharges, freightTaxPercent, packingCharges, conversionRate } = this.state.formData;
    let amtAgreed = 0;
    (lineItems || []).forEach(item => {
      amtAgreed += parseFloat(item.itemTotal || 0);
    });

    // Freight + packing
    const freightTaxAmt = (parseFloat(freightCharges || 0) * parseFloat(freightTaxPercent || 0)) / 100;
    amtAgreed += parseFloat(packingCharges || 0) + freightTaxAmt;

    // Apply conversion rate if needed
    let finalValue = amtAgreed;
    if (conversionRate) {
      finalValue = amtAgreed * parseFloat(conversionRate);
    }

    this.setState(prev => ({
      formData: {
        ...prev.formData,
        amtAgreed: finalValue.toFixed(2),
        contractValue: finalValue.toFixed(2),
        freightTaxAmt: freightTaxAmt.toFixed(2)
      }
    }));
  };

  handleTabChange = (idx) => this.setState({ activeTab: idx });

  handleNotesChange = (e) => this.setState({ notes: e.target.value });

handleSubmit = async (e) => {
  e.preventDefault();
  const { editingId, formData, contracts, notes } = this.state;
  if (!formData.customer) return alert("Customer is required");
  if (formData.lineItems.length === 0) return alert("At least one line item is required");

  const saveData = {
    ...formData,
    notes,
    status: "Awaiting Approval",
    createdAt: serverTimestamp(),
    billingTypes: this.state.billingTypes,
    paymentModes: this.state.paymentModes,
    autoBill: this.state.formData.autoBill,
    repeat: this.state.formData.repeat,
    tillDate: this.state.formData.tillDate,
  };

  if (editingId) {
    await updateDoc(doc(db, "contracts", editingId), saveData);
  } else {
    saveData.contractNo = `SC${1000 + contracts.length}`;
    await addDoc(collection(db, "contracts"), saveData);
  }

  this.setState({
    showForm: false,
    editingId: null,
    formData: this.getEmptyContractForm(),
    notes: ''
  });
  this.fetchContracts();
};

renderAlert = () => (
    <Modal show={this.state.showAlert} onHide={() => this.setState({ showAlert: false })} centered>
      <Modal.Body>
        <div className="text-center">{this.state.alertMsg}</div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={() => this.setState({ showAlert: false })}>OK</Button>
      </Modal.Footer>
    </Modal>
  );

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
              <td >{tg.groupName}</td>
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

 renderContractNoField = () => {
    const { formData } = this.state;
    return (
      <div className="form-group col-md-2">
        <label>Contract No</label>
        {formData.contractType === "Standard" ? (
          <input
            type="text"
            className="form-control form-control-sm"
            value={formData.contractNo}
            readOnly
            placeholder="Auto"
          />
        ) : (
          <input
            type="text"
            className="form-control form-control-sm"
            value={formData.contractNo}
            onChange={e => this.handleInputChange('contractNo', e.target.value)}
            placeholder="Enter Contract No"
          />
        )}
      </div>
    );
  };

showCustomerOverlay = () => this.setState({ showCustomerOverlay: true, customerOverlaySearch: '' });
hideCustomerOverlay = () => this.setState({ showCustomerOverlay: false, customerOverlaySearch: '' });

renderCustomerOverlay = () => {
  const { customers, customerOverlaySearch } = this.state;
  const filtered = customers.filter(c =>
    (c.custname || '').toLowerCase().includes(customerOverlaySearch.toLowerCase()) ||
    (c.custcode || '').toLowerCase().includes(customerOverlaySearch.toLowerCase()) ||
    (c.custshortName || '').toLowerCase().includes(customerOverlaySearch.toLowerCase())
  );
  return (
     <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="custom-overlay-title">Select Customer</div>
        <i className='mdi mdi-close-box-outline'
        style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }} 
            onClick={()=> this.setState({ showCustomerOverlay: false, customerOverlaySearch: '' })}
            aria-label="Close"
            type="button"
          >
          </i>
        </div>
        <input
          type="text"
          className="form-control mb-2"
          placeholder={`Search customer`}
          value={customerOverlaySearch}
          onChange={e => this.setState({ customerOverlaySearch: e.target.value })}
        />
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Short Name</th>
                <th>Select</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id || i}>
                  <td>{c.custname}</td>
                  <td>{c.custcode}</td>
                  <td>{c.custshortName}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => this.selectCustomer(c)}
                    >Select</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center">No customers found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

showCustomerOrderOverlay = () => this.setState({ showCustomerOrderOverlay: true, customerOrderOverlaySearch: '' });
hideCustomerOrderOverlay = () => this.setState({ showCustomerOrderOverlay: false, customerOrderOverlaySearch: '' });

renderCustomerOrderOverlay = () => {
  const { customerOrders, customerOrderOverlaySearch } = this.state;
  const filtered = customerOrders.filter(o =>
    (o.orderNo || '').toLowerCase().includes(customerOrderOverlaySearch.toLowerCase())
  );
  return (
     <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="custom-overlay-title">Select Customer Order</div>
        <i className='mdi mdi-close-box-outline'
        style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }} 
            onClick={()=> this.setState({ showCustomerOrderOverlay: false, customerOrderOverlaySearch: '' })}
            aria-label="Close"
            type="button"
          >
          </i>
        </div>
        <input
          type="text"
          className="form-control mb-2"
          placeholder={`Search Customer Orders`}
          value={customerOrderOverlaySearch}
          onChange={e => this.setState({ customerOrderOverlaySearch: e.target.value })}
        />
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Date</th>
                <th>Value</th>
                <th>Select</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id || i}>
                  <td>{o.orderNo}</td>
                  <td>{o.orderDate}</td>
                  <td>{o.orderValue}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => this.selectCustomerOrder(o)}
                    >Select</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center">No approved orders found</td>
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
    const { products, productOverlaySearch, selectedProductIds,currentPage=1 } = this.state;
    const filtered = products.filter(p =>
      (p.ptshortName || '').toLowerCase().includes(productOverlaySearch.toLowerCase()) ||
      (p.ptdescription || '').toLowerCase().includes(productOverlaySearch.toLowerCase()) ||
      (p.itemCode || '').toLowerCase().includes(productOverlaySearch.toLowerCase())
    );
    const itemsPerPage=10;
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
            <i
              className="mdi mdi-close-box-outline"
              style={{ fontSize: "24px", color: "#2196F3", cursor: "pointer" }}
              onClick={this.hideProductOverlay}
              aria-label="Close"
              type="button"
            ></i>
           </div>
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Search by code or name..."
            value={productOverlaySearch}
            onChange={e => this.setState({ productOverlaySearch: e.target.value })}
          />
           <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item Desc</th>
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((p, i) => (
                  <tr key={p.id || i}>
                    <td>{p.productId}</td>
                    <td>{p.ptdescription}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => this.selectProductForLineItem(p)}
                      >Select</button>
                    </td>
                  </tr>
                ))}
 {paginated.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center">No products found</td>
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
        </nav>  </div>
      </div>
      </div>
    );
  };

  
  renderTabs = () => {
    const { activeTab } = this.state;
    const tabNames = ['Lines', 'Terms', 'Notes'];
    return (
      <ul className="nav nav-tabs mb-3" style={{ fontSize: '16px' }}>
        {tabNames.map((tab, idx) => (
          <li className="nav-item" key={tab}>
            <button
              type="button"
              className={`nav-link${activeTab === idx ? ' active' : ''}`}
              onClick={() => this.handleTabChange(idx)}
              style={{
                color: '#007bff',
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
isOneYear = (from, to) => {
  if (!from || !to) return false;
  const d1 = new Date(from);
  const d2 = new Date(to);
  return d2.getFullYear() - d1.getFullYear() === 1 &&
         d2.getMonth() === d1.getMonth() &&
         d2.getDate() === d1.getDate();
};

updateLineItemsForAutoBill = () => {
  const { paymentModes, formData } = this.state;
  const { durationFrom, durationTo } = formData;
  const from = new Date(durationFrom);
  const to = new Date(durationTo);
  let days = 0, months = 1;
  if (paymentModes.includes('prorate')) {
    days = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate() - from.getDate() + 1;
  }
  if (paymentModes.includes('monthly')) {
    months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  }
  const updatedItems = (formData.lineItems || []).map(item => ({
    ...item,
    days,
    months
  }));
  this.setState(prev => ({
    formData: { ...prev.formData, lineItems: updatedItems }
  }), this.recalculateContractTotals);
};
updateLineItemsForBillingTypes = () => {
  const { billingTypes, formData } = this.state;
  let months = 1;
  if (billingTypes.includes('yearly')) months = 12;
  else if (billingTypes.includes('half-yearly')) months = 6;
  else if (billingTypes.includes('quarterly')) months = 3;
  const updatedItems = (formData.lineItems || []).map(item => ({
    ...item,
    months
  }));
  this.setState(prev => ({
    formData: { ...prev.formData, lineItems: updatedItems }
  }), this.recalculateContractTotals);
};

updateLineItemsForPaymentModes = () => {
  const { paymentModes, formData } = this.state;
  const { durationFrom, durationTo } = formData;
  const from = new Date(durationFrom);
  const to = new Date(durationTo);
  let days = 0, months = 1;
  let totalFullMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

if (paymentModes.includes('prorate') && paymentModes.includes('monthly')) {
    days = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate() - from.getDate() + 1;
    months = totalFullMonths ; 
} else if (paymentModes.includes('prorate')) {
    months = 0;
    days = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate() - from.getDate() + 1;

} else if (paymentModes.includes('monthly')) {
    days=0;
    months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;

} else {
    days = 0;
    months = 1; 
  }
  
  const updatedItems = (formData.lineItems || []).map(item => ({
    ...item,
    days,
    months
  }));
  this.setState(prev => ({
    formData: { ...prev.formData, lineItems: updatedItems }
  }), this.recalculateContractTotals);
};
renderBillingTypeSection = () => {
  const { billingTypes, autoBill } = this.state;
  return (
    <div className="form-row mb-2 d-flex align-items-center">
      <label className="mr-2 mb-0">Billing Type:</label>
      {['quarterly', 'half-yearly', 'yearly'].map(type => (
        <div key={type} className="form-check form-check-inline d-flex align-items-center">
          <input
            className="form-check-input mt-0"
            type="radio"
            checked={billingTypes.includes(type)}
            onChange={e => {
              let updated = billingTypes.includes(type)
                ? billingTypes.filter(t => t !== type)
                : [...billingTypes, type];
              this.setState({ billingTypes: updated }, () => this.updateLineItemsForBillingTypes());
            }}
          />
          <label className="form-check-label ml-1 mb-0">
            {type.replace('-', ' ').replace('yearly', 'Yearly').replace('half', 'Half').replace('quarterly', 'Quarterly')}
          </label>
        </div>
      ))}
    </div>
  );
};

renderPaymentModeSection = () => {
  const { paymentModes } = this.state;
  return (
    <div className="form-row mb-2">
      <label className="mr-2">Payment Mode:</label>
      {['prorate', 'monthly', 'lump-sum'].map(mode => (
        <div key={mode} className="form-check form-check-inline">
          <input
            className="form-check-input"
            type="checkbox"
            checked={paymentModes.includes(mode)}
            onChange={e => {
              let updated = paymentModes.includes(mode)
                ? paymentModes.filter(m => m !== mode)
                : [...paymentModes, mode];
              this.setState({ paymentModes: updated }, () => this.updateLineItemsForPaymentModes());
            }}
          />
          <label className="form-check-label">{mode.charAt(0).toUpperCase() + mode.slice(1)}</label>
        </div>
      ))}
    </div>
  );
};

renderLinesTab = () => {
  const months = this.state.formData.repeat && this.isOneYear(this.state.formData.durationFrom, this.state.formData.durationTo) ? 12 : 1;
  const { formData, showProductOverlay } = this.state;
  return (
    <div>
      <div className="form-row mb-2">
        <button
          type="button"
          className="btn btn-primary btn-sm mr-2"
          onClick={this.handleAddItemsClick}
        >
          Add Items
        </button>
      </div>
      <div className="table-responsive" style={{ overflowX: 'auto' }}>
        <table className="table table-bordered" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Item Desc</th>
              <th>HSN</th>
              <th>UOM</th>
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
            {(formData.lineItems || []).map((item, idx) => (
              <tr key={idx}>
                <td>{item.itemCode}</td>
                <td>{item.itemDesc}</td>
                <td>{item.hsnCode}</td>
                <td>{item.uom}</td>
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
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={item.unitPrice}
                    min="0"
                    style={{ width: 100 }}
                    onChange={e => this.handleLineItemChange(idx, 'unitPrice', e.target.value)}
                  />
                </td>
                <td>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={item.days || ''}
                  min="0"
                  style={{ width: 80 }}
                  onChange={e => this.handleLineItemChange(idx, 'days', e.target.value)}
                />
              </td>
                <td>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={item.months}
                    min="1"
                    style={{ width: 80 }}
                    onChange={e => this.handleLineItemChange(idx, 'months', e.target.value)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-link btn-sm"
                    onClick={() => this.setState({ showTaxOverlay: true, currentTaxLineIdx: idx })}
                  >
                    {item.taxGroupNames && item.taxGroupNames.length > 0
                      ? item.taxGroupNames.join(', ')
                      : 'Select Tax'}
                  </button>
                </td>
                <td>{item.taxAmt}</td>
                <td>{item.itemTotal}</td>
              </tr>
            ))}
            {(!formData.lineItems || formData.lineItems.length === 0) && (
              <tr>
                <td colSpan="12" className="text-center">No items</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {showProductOverlay && this.renderProductOverlay()}
    </div>
  );
};

  renderTermsTab = () => {
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
        <div className="form-row">
          <div className="form-group col-md-3">
            <label>Freight Charges</label>
            <input type="number" className="form-control form-control-sm" value={formData.freightCharges} onChange={e => this.handleInputChange('freightCharges', e.target.value)} />
          </div>
          <div className="form-group col-md-3">
            <label>Freight Tax %</label>
            <input type="number" className="form-control form-control-sm" value={formData.freightTaxPercent} onChange={e => this.handleInputChange('freightTaxPercent', e.target.value)} />
          </div>
          <div className="form-group col-md-3">
            <label>Freight Tax Amt</label>
            <input type="number" className="form-control form-control-sm" value={formData.freightTaxAmt} readOnly />
          </div>
          <div className="form-group col-md-3">
            <label>Packing Charges</label>
            <input type="number" className="form-control form-control-sm" value={formData.packingCharges} onChange={e => this.handleInputChange('packingCharges', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-3">
            <label>Amount Limit</label>
            <input type="number" className="form-control form-control-sm" value={formData.amountLimit} onChange={e => this.handleInputChange('amountLimit', e.target.value)} />
          </div>
          <div className="form-group col-md-3">
            <label>Minimum Release</label>
            <input type="number" className="form-control form-control-sm" value={formData.minimumRelease} onChange={e => this.handleInputChange('minimumRelease', e.target.value)} />
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
    const { activeTab, formData } = this.state;
    return (
      <div className="card full-height">
        <form className="form-sample" onSubmit={this.handleSubmit}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <h4 className="mb-3">Service Contract Creation/Update</h4>
            <div className="form-row">
              <div className="form-group col-md-3">
                <label>Contract Type</label>
                <select
                  className="form-control form-control-sm"
                  value={formData.contractType}
                  onChange={e => this.handleInputChange('contractType', e.target.value)}
                >
                  <option value="Standard">Standard</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
                {this.renderContractNoField()}
              <div className="form-group col-md-2">
                <label>Created Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={formData.createdDate}
                  onChange={e => this.handleInputChange('createdDate', e.target.value)}
                />
              </div>
              <div className="form-group col-md-2">
                <label>Status</label>
                <input type="text" className="form-control form-control-sm" value={formData.status} readOnly />
              </div>
              <div className="form-group col-md-2">
                <label>Name of Work</label>
                <input type="text" className="form-control form-control-sm" value={formData.nameofwrk}/>
              </div>
             

              
            </div>
            <div className="form-row">
              <div className="form-group col-md-3">
                <label>Customer</label>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Choose Customer"
                    value={formData.customer}
                    readOnly
                    onClick={this.showCustomerOverlay}
                    style={{ cursor: 'pointer' }}
                  />
                  <div className="input-group-append">
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={this.showCustomerOverlay}>Select</button>
                  </div>
                </div>
              </div>
              <div className="form-group col-md-3">
                <label>Customer Order</label>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Select Order"
                    value={formData.customerOrderId || ''}
                    readOnly
                    onClick={this.showCustomerOrderOverlay}
                    style={{ cursor: 'pointer' }}
                  />
                  <div className="input-group-append">
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={this.showCustomerOrderOverlay}>Select</button>
                  </div>
                </div>
              </div>
               <div className="form-group col-md-2">
                <label>Ref No</label>
                <input type="text" className="form-control form-control-sm" value={formData.refNo} onChange={e => this.handleInputChange('refNo', e.target.value)} />
              </div>
              <div className="form-group col-md-2">
                <label>Currency</label>
                <input type="text" className="form-control form-control-sm" value={formData.currency} readOnly />
              </div>
              <div className="form-group col-md-2">
                <label>Conversion Rate</label>
                <input type="number" className="form-control form-control-sm" value={formData.conversionRate} onChange={e => this.handleInputChange('conversionRate', e.target.value)} />
              </div>
              </div>
              <div className="form-row">
  <div className="form-group col-md-3">
    <label>Contr.Duration From</label>
    <Form.Control
      type="date"
      value={this.state.formData.durationFrom || ''}
      onChange={e => this.handleInputChange('durationFrom', e.target.value)}
    />
  </div>
  <div className="form-group col-md-3">
    <label>Contr.Duration To</label>
    <Form.Control
      type="date"
      value={this.state.formData.durationTo || ''}
      onChange={e => this.handleInputChange('durationTo', e.target.value)}
    />
  </div>
  <div className="form-group col-md-2">
                <label>Amt.Agreed</label>
                <input type="number" className="form-control form-control-sm" value={formData.amtAgreed} onChange={e => this.handleInputChange('amtAgreed', e.target.value)} />
              </div>
  <div className="form-group col-md-2">
  <label>Till Date</label>
  <Form.Control
    type="date"
    value={this.state.formData.tillDate || ''}
    onChange={e => this.handleInputChange('tillDate', e.target.value)}
  />
</div>
<div className="form-check form-check-inline d-flex align-items-center ml-3">
  <input
    type="checkbox"
    checked={this.state.formData.repeat || false}
    onChange={e => this.handleInputChange('repeat', e.target.checked)}
  />
  <label className="form-check-label ml-1 mb-0">Repeat</label>
</div>
  
     <div className="form-check form-check-inline d-flex align-items-center ml-3">
  <input
    type="checkbox"
    checked={this.state.formData.autoBill || false}
    onChange={e => this.handleInputChange('autoBill', e.target.checked)}
  />
  <label className="form-check-label ml-1 mb-0">Auto Bill</label>
</div>

  {this.renderBillingTypeSection()}
  {this.renderPaymentModeSection()}
            </div>
            {this.renderTabs()}
            {activeTab === 0 && this.renderLinesTab()}
            {activeTab === 1 && this.renderTermsTab()}
            {activeTab === 2 && this.renderNotesTab()}
            <div className="fixed-card-footer text-right p-3 border-top bg-white">
              <button type="submit" className="btn btn-success mr-2">
                {this.state.editingId ? "Update" : "Create"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => this.setState({ showForm: false, editingId: null, formData: this.getEmptyContractForm(), notes: '' })}>Cancel</button>
            </div>
          </div>
        </form>
         {this.state.showAlert && this.renderAlert()}
        {this.state.showCustomerOrderOverlay && this.renderCustomerOrderOverlay()}
      </div>
    );
  };



renderTable = () => (
  <div className="card mt-4 full-height">
    <div className="card-body">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="card-title">Service Contracts</h4>
         <div className="d-flex align-items-center" style={{ gap: '10px', width: '40%' }}>
          <input
              type="text"
              className="form-control"
              placeholder="Search by Bill No, Customer, Status, Date..."
              value={this.state.searchTerm}
              onChange={(e) => this.setState({ searchTerm: e.target.value })}
            />
          </div>
        <button className="btn btn-primary" onClick={() => this.setState({ showForm: true })}>+ Create Contract</button>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="thead-light">
            <tr>
              <th>Contract No</th>
              <th>Date</th>
              <th>Ref No</th>
              <th>Customer</th>
              <th>Currency</th>
              <th>Status</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {this.state.contracts
            .filter((q) =>{
              const term = this.state.searchTerm.toLowerCase();
              if(!term) return true;
              return (
                (q.contractNo || '').toLowerCase().includes(term) ||
                (q.customer || '').toLowerCase().includes(term) ||
                (q.status || '').toLowerCase().includes(term) ||
                (q.createdDate || '').toLowerCase().includes(term) ||
                (q.refNo || '').toLowerCase().includes(term) ||
                (q.contractValue?.toString() || '').toLowerCase().includes(term)
              );
            })
            .map((c, i) => {
              let statusClass = "badge-secondary";
              if (c.status === "Awaiting Approval") statusClass = "badge-warning";
              else if (c.status === "Approved") statusClass = "badge-success";
              else if (c.status === "Partial") statusClass = "badge-secondary"; // you need to define css .badge-purple { background:#6f42c1; }
              else if (c.status === "Completed") statusClass = "badge-info";

              return (
                <tr key={i}>
                  <td>
                    <button
                      className="btn btn-link p-0"
                      onClick={() => this.setState({
                        showForm: true,
                        editingId: c.id,
                        formData: { ...c }
                      })}
                    >
                      {c.contractNo}
                    </button>
                  </td>
                  <td>{this.formatDate(c.createdDate)}</td>
                  <td>{c.refNo}</td>
                  <td>{c.customer}</td>
                  <td>{c.currency}</td>
                  <td>
                    <label className={`badge ${statusClass}`} style={{ fontSize: '14px' }}>{c.status}</label>
                  </td>
                  <td>{c.contractValue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);


  render() {
    return (
      <div className="container-fluid">
        {this.state.showCustomerOverlay && this.renderCustomerOverlay()}
        {this.state.showProductOverlay && this.renderProductOverlay()}
        {this.state.showForm ? this.renderForm() : this.renderTable()}
        {this.state.showTaxOverlay && this.renderTaxOverlay()}
      </div>
         );
  }
}

export default ContractBilling;