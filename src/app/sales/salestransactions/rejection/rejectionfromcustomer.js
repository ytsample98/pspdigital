import React, { Component } from 'react';
import { db } from '../../../../firebase';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

class RejectionFromCustomer extends Component {
  state = {
    customers: [],
    invoices: [],
    selectedCustomer: null,
    selectedInvoice: null,
    formData: {
      docNo: '',
      docDate: '',
      status: 'Draft',
      customerCode: '',
      customerName: '',
      saleInvoiceNo: '',
      invoiceDate: '',
      invoiceType: '',
      currency: 'INR',
      conversionRate: 1,
      invoiceValue: '',
      taxValue: '',
      totalValue: '',
      lineItems: [],
    },
    lineItems: [],
    loading: false,
    searchTerm: '',
  };

  async componentDidMount() {
    await this.fetchCustomers();
    await this.fetchInvoices();
  }

  fetchCustomers = async () => {
    const snap = await getDocs(collection(db, 'customers'));
    const customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    this.setState({ customers });
  };

  fetchInvoices = async () => {
    // Fetch both direct billing and customer order billing, only approved
    const snapDirect = await getDocs(collection(db, 'invoices'));
    const direct = snapDirect.docs
      .map(d => ({ id: d.id, ...d.data(), source: 'direct' }))
      .filter(inv => inv.status === 'Approved');

    const snapCOB = await getDocs(collection(db, 'cobilling'));
    const cob = snapCOB.docs
      .map(d => ({ id: d.id, ...d.data(), source: 'cob' }))
      .filter(bill => bill.status === 'Approved');

    this.setState({ invoices: [...direct, ...cob] });
  };

  handleFormChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleCustomerSelect = (custId) => {
    const customer = this.state.customers.find(c => c.id === custId);
    if (!customer) return;
    this.setState(prev => ({
      selectedCustomer: customer,
      formData: {
        ...prev.formData,
        customerCode: customer.custcode || '',
        customerName: customer.custname || '',
      }
    }));
  };

  handleInvoiceSelect = (invId) => {
    const invoice = this.state.invoices.find(inv => inv.id === invId);
    if (!invoice) return;
    // Fill form fields from invoice
    const currency = invoice.currency || 'INR';
    const conversionRate = invoice.conversionRate || 1;
    this.setState(prev => ({
      selectedInvoice: invoice,
      formData: {
        ...prev.formData,
        saleInvoiceNo: invoice.source === 'direct' ? invoice.invoiceNo : invoice.cobillingNo,
        invoiceDate: invoice.source === 'direct' ? invoice.invoiceDate : invoice.cobillingDate,
        invoiceType: invoice.source === 'direct' ? 'Direct' : 'Customer',
        currency,
        conversionRate,
        invoiceValue: invoice.source === 'direct' ? invoice.invoiceValue : invoice.billValue,
        taxValue: invoice.taxAmount || invoice.taxAmt || '',
        totalValue: invoice.afterDiscountValue || invoice.billValue || '',
        lineItems: (invoice.lineItems || []).map(li => ({
          ...li,
          rejectedQty: '',
          quantity: li.qty, // initial remaining qty = invoice qty
        })),
      }
    }));
  };

  handleLineItemChange = (idx, field, value) => {
    const items = [...this.state.formData.lineItems];
    items[idx][field] = value;

    // Calculate remaining quantity
    if (field === 'rejectedQty') {
      const invQty = parseFloat(items[idx].qty || 0);
      const rejQty = parseFloat(value || 0);
      items[idx].quantity = Math.max(0, invQty - rejQty);
    }

    // Calculate item value and tax amount
    const unitP = parseFloat(items[idx].unitPrice || 0);
    const qty = parseFloat(items[idx].quantity || 0);
    const taxPercent = items[idx].taxPercent || 0;
    const taxAmt = ((unitP * qty) * (taxPercent / 100));
    items[idx].taxAmount = taxAmt.toFixed(2);
    items[idx].itemValue = (unitP * qty + taxAmt).toFixed(2);

    this.setState(prev => ({
      formData: { ...prev.formData, lineItems: items }
    }), this.recalculateTotals);
  };

  recalculateTotals = () => {
    const { lineItems } = this.state.formData;
    let taxValue = 0, totalValue = 0;
    (lineItems || []).forEach(li => {
      taxValue += parseFloat(li.taxAmount || 0);
      totalValue += parseFloat(li.itemValue || 0);
    });
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        taxValue: taxValue.toFixed(2),
        totalValue: totalValue.toFixed(2)
      }
    }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    this.setState({ loading: true });
    try {
      await addDoc(collection(db, 'rejectionfromcustomer'), {
        ...this.state.formData,
        createdAt: new Date().toISOString(),
        status: this.state.formData.status || 'Draft'
      });
      alert('Saved!');
      // Optionally reset form
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      this.setState({ loading: false });
    }
  };

  render() {
    const { formData, customers, invoices, loading } = this.state;
    return (
      <div className="container-fluid mt-3">
        <div className="card full-height">
          <div className="card-body">
            <h4 className="card-title mb-3">Rejection from Customer Create/Update</h4>
            <form onSubmit={this.handleSubmit}>
              <div className="row g-2">
                <div className="col-md-2">
                  <label>Doc No *</label>
                  <input type="text" className="form-control" value={formData.docNo}
                    onChange={e => this.handleFormChange('docNo', e.target.value)} required />
                </div>
                <div className="col-md-2">
                  <label>Doc Date *</label>
                  <input type="date" className="form-control" value={formData.docDate}
                    onChange={e => this.handleFormChange('docDate', e.target.value)} required />
                </div>
                <div className="col-md-2">
                  <label>Status *</label>
                  <select className="form-control" value={formData.status}
                    onChange={e => this.handleFormChange('status', e.target.value)}>
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label>Customer Code & Name *</label>
                  <select className="form-control"
                    value={formData.customerCode}
                    onChange={e => this.handleCustomerSelect(e.target.value)} required>
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.custcode} - {c.custname}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label>Sale Invoice No *</label>
                  <select className="form-control"
                    value={formData.saleInvoiceNo}
                    onChange={e => this.handleInvoiceSelect(e.target.value)} required>
                    <option value="">Select Invoice</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.source === 'direct' ? inv.invoiceNo : inv.cobillingNo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row g-2 mt-2">
                <div className="col-md-2">
                  <label>Invoice Date</label>
                  <input type="text" className="form-control" value={formData.invoiceDate} readOnly />
                </div>
                <div className="col-md-2">
                  <label>Invoice Type</label>
                  <input type="text" className="form-control" value={formData.invoiceType} readOnly />
                </div>
                <div className="col-md-2">
                  <label>Currency</label>
                  <input type="text" className="form-control" value={formData.currency} readOnly />
                </div>
                <div className="col-md-2">
                  <label>Conversion Rate</label>
                  <input type="number" className="form-control" value={formData.conversionRate} readOnly />
                </div>
                <div className="col-md-2">
                  <label>Invoice Value</label>
                  <input type="number" className="form-control" value={formData.invoiceValue} readOnly />
                </div>
                <div className="col-md-2">
                  <label>Tax Value</label>
                  <input type="number" className="form-control" value={formData.taxValue} readOnly />
                </div>
                <div className="col-md-2">
                  <label>Total Value</label>
                  <input type="number" className="form-control" value={formData.totalValue} readOnly />
                </div>
              </div>
              <div className="mt-3">
                <h5>Line Items</h5>
                <div className="table-responsive">
                  <table className="table table-bordered table-sm">
                    <thead className="thead-light">
                      <tr>
                        <th>Item Code</th>
                        <th>Item Short Name</th>
                        <th>Item Desc</th>
                        <th>UOM</th>
                        <th>Unit P</th>
                        <th>Invoice Qty</th>
                        <th>Rejected Qty</th>
                        <th>Quantity</th>
                        <th>Tax Amount</th>
                        <th>Tax</th>
                        <th>Item Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formData.lineItems || []).map((li, idx) => (
                        <tr key={idx}>
                          <td>{li.itemCode}</td>
                          <td>{li.ptshortName || li.itemShortName || ''}</td>
                          <td>{li.itemDescription || li.itemDesc || ''}</td>
                          <td>{li.uom}</td>
                          <td>{li.unitPrice}</td>
                          <td>{li.qty}</td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              value={li.rejectedQty || ''}
                              min="0"
                              max={li.qty}
                              onChange={e => this.handleLineItemChange(idx, 'rejectedQty', e.target.value)}
                            />
                          </td>
                          <td>{li.quantity}</td>
                          <td>{li.taxAmount}</td>
                          <td>{li.taxGroupNames ? li.taxGroupNames.join(', ') : li.taxGroupName || ''}</td>
                          <td>{li.itemValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-3 text-right">
                <button className="btn btn-primary" disabled={loading}>Save</button>
                <button className="btn btn-secondary ml-2" type="button" onClick={() => window.history.back()}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

export default RejectionFromCustomer;