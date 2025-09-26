import React, { Component } from "react";
import { db } from "../../../../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

class IndirectBilling extends Component {
  state = {
    suppliers: [],
    products: [],
    bills: [],
    taxGroups: [],
    showForm: false,
    editingId: null,
    activeTab: 0,
    showSupplierOverlay: false,
    supplierOverlaySearch: "",
    showProductOverlay: false,
    productOverlaySearch: "",
    selectedProductIds: [],
    formData: this.getEmptyForm(),
    notes: "",
  };

  getEmptyForm() {
    return {
      billType: "Standard",
      billNo: "",
      billDate: new Date().toISOString().split("T")[0],
      status: "Entered",
      refNo: "",
      supplierId: "",
      supplier: "",
      currency: "",
      conversionRate: "",
      stockType: "Select",
      returnDays: "",
      totalValue: "",
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
    this.fetchSuppliers();
    this.fetchProducts();
    this.fetchBills();
    this.fetchTaxGroups();
  }

  fetchSuppliers = async () => {
    const snap = await getDocs(collection(db, "suppliers"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ suppliers: data });
  };

  fetchProducts = async () => {
    const snap = await getDocs(collection(db, "products"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ products: data });
  };

  fetchBills = async () => {
    const snap = await getDocs(collection(db, "indirectBills"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ bills: data.reverse() });
  };

  fetchTaxGroups = async () => {
    const snap = await getDocs(collection(db, "taxGroups"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ taxGroups: data });
  };

  selectSupplier = (s) => {
    this.setState((prev) => ({
      formData: {
        ...prev.formData,
        supplierId: s.id,
        supplier: s.spName,
        currency: s.currency,
        billTo: s.address || "",
        shipTo: s.address || "",
        despatchMode: s.despatchMode || "",
        paymentTerms: s.paymentTerms || "",
      },
      showSupplierOverlay: false,
    }));
  };

  showSupplierOverlay = () => this.setState({ showSupplierOverlay: true, supplierOverlaySearch: "" });
  hideSupplierOverlay = () => this.setState({ showSupplierOverlay: false, supplierOverlaySearch: "" });

  showProductOverlay = () => this.setState({ showProductOverlay: true, productOverlaySearch: "", selectedProductIds: [] });
  hideProductOverlay = () => this.setState({ showProductOverlay: false, productOverlaySearch: "", selectedProductIds: [] });

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
        itemCode: product.productId || "",
        shortName: product.ptshortName || "",
        itemDesc: product.ptdescription || "",
        hsnCode: product.hsnCode || "",
        uom: product.uom || "",
        store: product.store || "",
        onHand: product.onHand || "",
        shipQty: "",
        unitPrice: "",
        itemTotal: "",
        taxGroupNames: [],   
        taxAmt: "",          
        months: "",
        unitDayOrWk: "",
        schedule: "",
        }));

    this.setState(prev => ({
      formData: {
        ...prev.formData,
        lineItems: [...prev.formData.lineItems, ...newItems]
      },
      showProductOverlay: false,
      selectedProductIds: []
    }), this.recalculateBillTotals);
  };

  handleInputChange = (field, value) => {
    this.setState((prev) => ({
      formData: { ...prev.formData, [field]: value },
    }), () => {
      if ([
        "freightCharges", "freightPercent", "packingCharges", "conversionRate", "totalValue"
      ].includes(field)) {
        this.recalculateBillTotals();
      }
    });
  };

  handleLineItemChange = (idx, field, value) => {
    const items = [...this.state.formData.lineItems];
    items[idx] = { ...items[idx], [field]: value };

    const qty = parseFloat(items[idx].shipQty || 0);
    const unitPrice = parseFloat(items[idx].unitPrice || 0);
    items[idx].itemTotal = (qty * unitPrice).toFixed(2);

    this.setState((prev) => ({
      formData: { ...prev.formData, lineItems: items },
    }), this.recalculateBillTotals);
  };

  recalculateBillTotals = () => {
    const { lineItems, freightCharges, freightPercent, packingCharges, conversionRate } = this.state.formData;
    let totalValue = 0;
    (lineItems || []).forEach(item => {
      totalValue += parseFloat(item.itemTotal || 0);
    });

    // Freight + packing
    const freightTaxAmt = (parseFloat(freightCharges || 0) * parseFloat(freightPercent || 0)) / 100;
    totalValue += parseFloat(freightCharges || 0) + parseFloat(packingCharges || 0) + freightTaxAmt;

    let finalValue = totalValue;
    if (conversionRate) {
      finalValue = totalValue * parseFloat(conversionRate);
    }

    this.setState(prev => ({
      formData: {
        ...prev.formData,
        totalValue: finalValue.toFixed(2),
        freightTaxAmt: freightTaxAmt.toFixed(2)
      }
    }));
  };

  handleTabChange = (i) => this.setState({ activeTab: i });

  handleSubmit = async (e) => {
    e.preventDefault();
    const { editingId, formData, bills } = this.state;
    const saveData = {
      ...formData,
      notes: this.state.notes,
      createdAt: serverTimestamp(),
    };
    if (editingId) {
      await updateDoc(doc(db, "indirectBills", editingId), saveData);
    } else {
      saveData.billNo = formData.billType === "Standard"
        ? `IB${1000 + bills.length}`
        : formData.billNo || `IB${1000 + bills.length}`;
      await addDoc(collection(db, "indirectBills"), saveData);
    }
    this.setState({
      showForm: false,
      editingId: null,
      formData: this.getEmptyForm(),
      notes: "",
    });
    this.fetchBills();
  };

  renderBillingDetailsTab = () => {
    const f = this.state.formData;
    const items = f.lineItems || [];
    return (
      <div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Bill Type</label>
            <select
              className="form-control"
              value={f.billType}
              onChange={e => this.handleInputChange("billType", e.target.value)}
            >
              <option value="Standard">Standard (Auto)</option>
              <option value="Manual">Manual (Typing)</option>
            </select>
          </div>
          <div className="form-group col-md-2">
            <label>Bill No</label>
            <input
              className="form-control"
              value={f.billNo}
              onChange={e => this.handleInputChange("billNo", e.target.value)}
              readOnly={f.billType === "Standard"}
              placeholder={f.billType === "Standard" ? "Auto" : "Enter Bill No"}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Bill Date</label>
            <input
              type="date"
              className="form-control"
              value={f.billDate}
              onChange={e => this.handleInputChange("billDate", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Status</label>
            <input className="form-control" value={f.status} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Ref No</label>
            <input
              className="form-control"
              value={f.refNo}
              onChange={e => this.handleInputChange("refNo", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Supplier</label>
            <input
              className="form-control"
              placeholder="Select Supplier"
              value={f.supplier}
              readOnly
              onClick={this.showSupplierOverlay}
              style={{ cursor: "pointer" }}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Currency</label>
            <input className="form-control" value={f.currency} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Conversion Rate</label>
            <input type="number" className="form-control" value={f.conversionRate} onChange={e => this.handleInputChange("conversionRate", e.target.value)} />
          </div>
          <div className="form-group col-md-2">
            <label>Stock Type</label>
            <select className="form-control" value={f.stockType} onChange={e => this.handleInputChange("stockType", e.target.value)}>
              <option value="Select">Select</option>
              <option value="Returnable">Returnable</option>
              <option value="Non-Returnable">Non-Returnable</option>
            </select>
          </div>
          <div className="form-group col-md-2">
            <label>Return Days</label>
            <input type="number" className="form-control" value={f.returnDays} onChange={e => this.handleInputChange("returnDays", e.target.value)} />
          </div>
          <div className="form-group col-md-2">
            <label>Total Value</label>
            <input className="form-control" value={f.totalValue} readOnly />
          </div>
        </div>
        <div className="d-flex justify-content-between align-items-center mt-3 mb-2">
            <h5>Line Items</h5>
            <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={this.showProductOverlay}
            >
                + Add Items
            </button>
            </div>
        <div className="table-responsive mt-3">
        <table className="table table-bordered">
          <thead className="thead-light">
            <tr>
              <th>Item Code</th>
              <th>Item Desc</th>
              <th>HSN/SAC</th>
              <th>UOM</th>
              <th>Locator</th>
              <th>On Hand</th>
              <th>Ship Qty</th>
              <th>Unit Price</th>
              <th>Item Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.itemCode}</td>
                <td>{it.itemDesc}</td>
                <td>{it.hsnCode}</td>
                <td>{it.uom}</td>
                <td>{it.locator}</td>
                <td>{it.onHand}</td>
                <td>
                  <input
                    type="number"
                    className="form-control"
                    value={it.shipQty}
                    onChange={e =>
                      this.handleLineItemChange(i, "shipQty", e.target.value)
                    }
                  />
                  </td>
                <td>
                  <input
                    type="number"
                    className="form-control"
                    value={it.unitPrice}
                    onChange={e =>
                      this.handleLineItemChange(i, "unitPrice", e.target.value)
                    }
                  />
                </td>
                <td>{it.itemTotal}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={14} className="text-center">No items</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
      
    
    );
  };


  renderPortTab = () => {
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
            <input className="form-control" value={f.despatchMode} onChange={e => this.handleInputChange("despatchMode", e.target.value)} />
          </div>
          <div className="form-group col-md-4">
            <label>Payment Terms</label>
            <input className="form-control" value={f.paymentTerms} onChange={e => this.handleInputChange("paymentTerms", e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-3">
            <label>Freight Charges</label>
            <input type="number" className="form-control" value={f.freightCharges} onChange={e => this.handleInputChange("freightCharges", e.target.value)} />
          </div>
          <div className="form-group col-md-3">
            <label>Freight %</label>
            <input type="number" className="form-control" value={f.freightPercent} onChange={e => this.handleInputChange("freightPercent", e.target.value)} />
          </div>
          <div className="form-group col-md-3">
            <label>Freight Tax Amount</label>
            <input className="form-control" value={f.freightTaxAmt} readOnly />
          </div>
          <div className="form-group col-md-3">
            <label>Packing Charges</label>
            <input type="number" className="form-control" value={f.packingCharges} onChange={e => this.handleInputChange("packingCharges", e.target.value)} />
          </div>
        </div>
      </div>
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

  renderTabs = () => {
    const tabs = ["Billing Details",  "Port & Terms", "Notes"];
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

  renderSupplierOverlay = () => {
    const { suppliers, supplierOverlaySearch } = this.state;
    const filtered = suppliers.filter(s =>
      (s.spName || "").toLowerCase().includes(supplierOverlaySearch.toLowerCase()) ||
      (s.spCode || "").toLowerCase().includes(supplierOverlaySearch.toLowerCase()) ||
      (s.spshortName || "").toLowerCase().includes(supplierOverlaySearch.toLowerCase())
    );
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <div className="custom-overlay-title">Select Supplier</div>
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Search by code, name, or short name"
            value={supplierOverlaySearch}
            onChange={e => this.setState({ supplierOverlaySearch: e.target.value })}
          />
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Short Name</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id || i} onClick={() => this.selectSupplier(s)} style={{ cursor: "pointer" }}>
                    <td>{s.spCode}</td>
                    <td>{s.spName}</td>
                    <td>{s.spshortName}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center">No suppliers found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={this.hideSupplierOverlay}>Cancel</button>
        </div>
      </div>
    );
  };

  renderProductOverlay = () => {
    const { products, productOverlaySearch, selectedProductIds } = this.state;
    const filtered = products.filter(p =>
      (p.productId || "").toLowerCase().includes(productOverlaySearch.toLowerCase()) ||
      (p.ptshortName || "").toLowerCase().includes(productOverlaySearch.toLowerCase()) ||
      (p.ptdescription || "").toLowerCase().includes(productOverlaySearch.toLowerCase())
    );
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <div className="custom-overlay-title">Select Products</div>
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Search by code, name, or desc..."
            value={productOverlaySearch}
            onChange={e => this.setState({ productOverlaySearch: e.target.value })}
          />
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th></th>
                  <th>Code</th>
                  <th>Short Name</th>
                  <th>Desc</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id || i}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={e => this.toggleProductSelection(p.id, e.target.checked)}
                      />
                    </td>
                    <td>{p.productId}</td>
                    <td>{p.ptshortName}</td>
                    <td>{p.ptdescription}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center">No products found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between mt-2">
            <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={this.addSelectedProductsToLineItems}
            >
                Add Selected
            </button>
            <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={this.hideProductOverlay}
            >
                Cancel
            </button>
            </div>
            </div>
      </div>
    );
  };

  renderForm = () => {
  return (
   
 <div className="card full-height">
        <form className="form-sample" onSubmit={this.handleSubmit}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
 <h4 className="mb-3">Indirect Billing</h4>
          {this.renderTabs()}
          {this.state.activeTab === 0 && this.renderBillingDetailsTab()}
          {this.state.activeTab === 1 && this.renderPortTab()}
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
}

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Indirect Billing</h4>
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ showForm: true })}>Create</button>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr>
                <th>Bill No</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Currency</th>
                <th>Total Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {this.state.bills.map((b, i) => (
                <tr key={i}>
                  <td>
                    <button
                    type="button"
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
                  <td>{b.supplier}</td>
                  <td>{b.currency}</td>
                  <td>{b.totalValue}</td>
                  <td>{b.status}</td>
                </tr>
              ))}
              {this.state.bills.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center">No records found</td>
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
      {this.state.showSupplierOverlay && this.renderSupplierOverlay()}
      {this.state.showProductOverlay && this.renderProductOverlay()}
    </div>
  );
}
}

export default IndirectBilling;