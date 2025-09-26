import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import bsCustomFileInput from 'bs-custom-file-input';
import { db } from '../../firebase';
import { collection, getDocs, addDoc,doc,updateDoc } from 'firebase/firestore';

export class Quote extends Component {
  state = {
    activeTab: 'co',
    quotes: [],
    editingId: null  

  };

  customerInputRef = React.createRef();

  formData = {
    quoteNo: '', quoteDate: new Date().toISOString().split('T')[0], quoteType: 'Standard', customer: '', status: 'Entered', choose: 'Service', refNo: '', impExp: 'None', currency: '', conversionRate: '', taxAmount: '', quoteValue: '', billTo: '', shipTo: '', despatchMode: 'By Air', paymentTerms: '', freightCharges: '', taxPercent: '', packingCharges: ''
  };

  componentDidMount() {
    bsCustomFileInput.init();
    this.fetchQuotes();
  }

  fetchQuotes = async () => {
     const snapshot = await getDocs(collection(db, 'quotes'));
      const quotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.setState({ quotes: quotes.reverse() });
      };

  handleInputChange = (field, value) => {
    this.formData[field] = value;
  };

  loadQuoteForEdit = (quote) => {
  this.formData = { ...quote };  //  Load all fields into formData
  this.setState({ editingId: quote.id, activeTab: 'co' }); //  optionally switch to first tab
  if (this.customerInputRef.current) {
    this.customerInputRef.current.value = quote.customer;
  }
};


  handleSubmit = async (e) => {
  if (e) e.preventDefault();

  try {
    if (this.state.editingId) {
      //  Update existing document
      const docRef = doc(db, 'quotes', this.state.editingId);
      await updateDoc(docRef, this.formData);
      console.log(' Quote updated!');
    } else {
      //  Add new document
      await addDoc(collection(db, 'quotes'), this.formData);
      console.log(' New quote saved!');
    }

    this.setState({ editingId: null });
    this.fetchQuotes();
  } catch (error) {
    console.error(' Error saving:', error);
  }
};


  showCustomerOverlay = () => {
    const overlay = document.getElementById('customerOverlay');
    if (overlay) overlay.style.display = 'flex';
  };

  hideCustomerOverlay = () => {
    const overlay = document.getElementById('customerOverlay');
    if (overlay) overlay.style.display = 'none';
  };

  selectCustomer = (name) => {
    if (this.customerInputRef.current) {
      this.customerInputRef.current.value = name;
      this.formData.customer = name;
    }
    this.hideCustomerOverlay();
  };

  render() {
    return (
       <div>
        <div className="page-header">
          <h3 className="page-title"> Form elements </h3>
        </div>

        <div className="col-12 grid-margin">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">Quote Form</h4>

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
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Quote No</label>
                        <div className="col-sm-9">
                          <Form.Control type="text" onChange={(e) => this.handleInputChange('quoteNo', e.target.value)} />
                        </div>
                      
                        <label className="col-sm-3 col-form-label">Quote Date</label>
                        <div className="col-sm-9">
                          <Form.Control type="date" defaultValue={this.formData.quoteDate} onChange={(e) => this.handleInputChange('quoteDate', e.target.value)} />
                        </div>
                      </Form.Group>
                      <div className="row">
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Quote Type</label>
                        <div className="col-sm-9">
                          <select className="form-control" defaultValue={this.formData.quoteType} onChange={(e) => this.handleInputChange('quoteType', e.target.value)} >
                            <option>Standard</option>
                            <option>Manual</option>
                          </select>
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group>
                      <label className="col-sm-3 col-form-label">Customer</label>
                      <div className="col-sm-9">
                        <div className="input-group">
                          <Form.Control
                            type="text"
                            className="form-control"
                            placeholder="Choose Customer"
                            ref={this.customerInputRef}

                            readOnly
                          />
                          <div className="input-group-append">
                            <button
                              className="btn btn-sm btn-primary"
                              type="button"
                              onClick={this.showCustomerOverlay}
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      </div>
                    </Form.Group>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Status</label>
                        <div className="col-sm-9">
                          <select className="form-control" defaultValue={this.formData.status} onChange={(e) => this.handleInputChange('status', e.target.value)} >
                            <option>Entered</option>
                            <option>On Process</option>
                            <option>Closed</option>
                          </select>
                        </div>
                        </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Choose</label>
                        <div className="col-sm-4">
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="ExampleRadio4"
                              id="membershipRadios1"
                              value="Service"
                              defaultChecked
                              onChange={(e) => this.handleInputChange('choose', e.target.value)}
                             />
                            Service
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        </div>
                        <div className="col-sm-5">
                        <div className="form-check">
                             <label className="form-check-label">
                                <input
                                  type="radio"
                                  className="form-check-input"
                                  name="ExampleRadio4"
                                  id="membershipRadios2"
                                  value="Product"
                                  onChange={(e) => this.handleInputChange('choose', e.target.value)}
                                />
                        Product 
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                  <p className="card-description"> Cost Details </p>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Ref No.</label>
                        <div className="col-sm-9">
                        <Form.Control type="text" onChange={(e) => this.handleInputChange('refNo', e.target.value)} />
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">IMP/EXP</label>
                        <div className="col-sm-9">
                        <select className="form-control" defaultValue={this.formData.impExp} onChange={(e) => this.handleInputChange('impExp', e.target.value)} >
                            <option>None</option>
                            <option>COB</option>
                            <option>FIP</option>
                          </select>
                        </div>

                      </Form.Group>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Currency</label>
                        <div className="col-sm-9">
                        <Form.Control type="text" onChange={(e) => this.handleInputChange('currency', e.target.value)} />
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Conversion Rate</label>
                        <div className="col-sm-9">
                        <Form.Control type="text" onChange={(e) => this.handleInputChange('conversionRate', e.target.value)} />
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Tax Amount</label>
                        <div className="col-sm-9">
                        <Form.Control type="number" onChange={(e) => this.handleInputChange('taxAmount', e.target.value)} />
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Quote Value</label>
                        <div className="col-sm-9">
                        <Form.Control type="number" onChange={(e) => this.handleInputChange('quoteValue', e.target.value)} />
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-lg-12 grid-margin stretch-card">
            <div className="card shadow">
              <div className="card-body">
                <h4 className="card-title">Line Item </h4>
                <p className="card-description">Item Details
                </p>
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th> ID </th>
                        <th> Name </th>
                        <th> UOM </th>
                        <th> Qty</th>
                        <th> Unit Price </th>
                        <th> Tax% </th>
                        <th>Amount </th>
                        <th> Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td> 1 </td>
                        <td> Oracle ERP </td>
                        <td> NOS </td>
                        <td> 1 </td>
                        <td> 20000 </td>
                        <td>18</td>
                        <td>2000</td>
                        <td>Entered</td>
                      </tr>
                      
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
          </div>
                     
                  </div>

                      {/* Repeat for other CO Details fields... */}
                    </>
                  )}

                  {this.state.activeTab === 'commercial' && (
                    <>
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Bill To</label>
                        <div className="col-sm-9">
                          <Form.Control as="textarea" onChange={(e) => this.handleInputChange('billTo', e.target.value)} />
                        </div>
                      </Form.Group>
                      <Form.Group>
                        <label className="col-sm-3 col-form-label">Ship To</label>
                        <div className="col-sm-9">
                          <Form.Control as="textarea" onChange={(e) => this.handleInputChange('shipTo', e.target.value)} />
                        </div>
                      </Form.Group>
                      <div className="row">
              <div className="col-md-6">
                <Form.Group>
                  <label>Despatch Mode</label>
                  <Form.Control
                    as="select"
                    defaultValue={this.formData.despatchMode}
                    onChange={(e) => this.handleInputChange('despatchMode', e.target.value) }
                  >
                    <option>By Air</option>
                    <option>By Sea</option>
                    <option>By Road</option>
                  </Form.Control>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <label>Payment Terms</label>
                  <Form.Control
                    as="select"
                    defaultValue={this.formData.paymentTerms}
                    onChange={(e) => this.handleInputChange('paymentTerms', e.target.value)}
                  >
                    <option>Net 15</option>
                    <option>Net 30</option>
                    <option>Net 60</option>
                  </Form.Control>
                </Form.Group>
              </div>
            </div>
            <div className="row">
              <div className="col-md-6">
                <Form.Group>
                  <label>Freight Charges</label>
                  <Form.Control
                    type="number"
                    onChange={(e) => this.handleInputChange('freightCharges', e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <label>Tax %</label>
                  <Form.Control
                    type="number"
                    onChange={(e) => this.handleInputChange('taxPercent', e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <label>Tax Amount</label>
                  <Form.Control
                    type="number"
                    onChange={(e) => this.handleInputChange('taxAmount', e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <label>Packing Charges</label>
                  <Form.Control
                    type="number"
                    onChange={(e) => this.handleInputChange('packingCharges', e.target.value)}
                  />
                </Form.Group>
              </div>
            </div>
            <div className="text-right mt-3">
                    <button type="submit" className="btn btn-success">Save All Details</button>
                  </div>
                      {/* Repeat for other commercial fields... */}
                    </>
                  )}

                 
                </div>
                 
              </form>
            </div>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-body">
            <h4 className="card-title">Quotes</h4>
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>Quote No</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Quote Value</th>
                    <th>Status</th>
                    
                  </tr>
                </thead>
                <tbody>
                  {this.state.quotes.map((q, i) => (
                    <tr key={i}>
                      <td> <button
                        className="btn btn-link p-0"
                        onClick={() => this.loadQuoteForEdit(q)}
                      >{q.quoteNo}</button></td>
                      <td>{q.customer}</td>
                      <td>{q.quoteDate}</td>
                      <td>{q.quoteValue}</td>
                      <td><label class="badge badge-info">{q.status}</label></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div id="customerOverlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'none', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '500px', maxHeight: '80%', overflowY: 'auto' }}>
            <h5>Select a Customer</h5>
            <ul className="list-group">
              {['Yaanar Tech', 'QTech', 'CMW'].map((cust, i) => (
                <li key={i} className="list-group-item list-group-item-action" style={{ cursor: 'pointer' }} onClick={() => this.selectCustomer(cust)}>{cust}</li>
              ))}
            </ul>
            <button className="btn btn-secondary mt-3" onClick={this.hideCustomerOverlay}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }
}

export default Quote;
