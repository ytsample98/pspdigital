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

class ThirdPartyBilling extends Component {
  state = {
    suppliers: [],
    products: [],
    bills: [],
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
      billAccType: "",
      billAccNo: "",
      billAccDate: new Date().toISOString().split("T")[0],
      status: "Entered",
      supplierCode: "",
      supplierName: "",
      supplierInvoiceNo: "",
      supplierInvoiceDate: "",
      currency: "",
      conversionRate: "",
      paymentTerms: "",
      dueDate: "",
      paymentReleaseDate: "",
      actualPaymentAmount: "",
      tdsAmount: "",
      tdsDoc: "",
      totalInvoiceValue: "",
      lineItems: [],
    };
  }

  componentDidMount() {
    this.fetchSuppliers();
    this.fetchProducts();
    this.fetchBills();
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
    const snap = await getDocs(collection(db, "thirdPartyBills"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.setState({ bills: data.reverse() });
  };

  selectSupplier = (s) => {
    this.setState((prev) => ({
      formData: {
        ...prev.formData,
        supplierCode: s.spCode,
        supplierName: s.spName,
        currency: s.currency,
        paymentTerms: s.paymentTerms || "",
      },
      showSupplierOverlay: false,
    }));
  };

  showSupplierOverlay = () =>
    this.setState({ showSupplierOverlay: true, supplierOverlaySearch: "" });
  hideSupplierOverlay = () =>
    this.setState({ showSupplierOverlay: false, supplierOverlaySearch: "" });

  showProductOverlay = () =>
    this.setState({ showProductOverlay: true, productOverlaySearch: "", selectedProductIds: [] });
  hideProductOverlay = () =>
    this.setState({ showProductOverlay: false, productOverlaySearch: "", selectedProductIds: [] });

  toggleProductSelection = (productId, checked) => {
    this.setState((prev) => ({
      selectedProductIds: checked
        ? [...prev.selectedProductIds, productId]
        : prev.selectedProductIds.filter((id) => id !== productId),
    }));
  };

  addSelectedProductsToLineItems = () => {
    const selectedProducts = this.state.products.filter((p) =>
      this.state.selectedProductIds.includes(p.id)
    );
    const newItems = selectedProducts.map((product) => ({
      itemCode: product.productId || "",
      itemDesc: product.ptdescription || "",
      uom: product.uom || " ",
      itemType: product.itemType || "",
      materialType: product.materialType || "",
      totalUnitPrice: "",
    }));
    this.setState(
      (prev) => ({
        formData: {
          ...prev.formData,
          lineItems: [...prev.formData.lineItems, ...newItems],
        },
        showProductOverlay: false,
        selectedProductIds: [],
      }),
      this.recalculateInvoiceValue
    );
  };

  handleInputChange = (field, value) => {
    this.setState(
      (prev) => ({
        formData: { ...prev.formData, [field]: value },
      }),
      () => {
        if (["tdsAmount", "actualPaymentAmount"].includes(field)) {
          this.recalculateInvoiceValue();
        }
      }
    );
  };

  handleLineItemChange = (idx, field, value) => {
    const items = [...this.state.formData.lineItems];
    items[idx] = { ...items[idx], [field]: value };
    this.setState(
      (prev) => ({
        formData: { ...prev.formData, lineItems: items },
      }),
      this.recalculateInvoiceValue
    );
  };

  recalculateInvoiceValue = () => {
    const { lineItems, tdsAmount } = this.state.formData;
    let total = 0;
    (lineItems || []).forEach((item) => {
      total += parseFloat(item.totalUnitPrice || 0);
    });
    total += parseFloat(tdsAmount || 0);
    this.setState((prev) => ({
      formData: {
        ...prev.formData,
        totalInvoiceValue: total ? total.toFixed(2) : "",
      },
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
    await updateDoc(doc(db, "thirdPartyBills", editingId), saveData);
  } else {
    if (formData.billAccType === "Standard") {
      saveData.billAccNo = `TPB${1000 + bills.length}`;
    }
    await addDoc(collection(db, "thirdPartyBills"), saveData);
  }
  this.setState({
    showForm: false,
    editingId: null,
    formData: this.getEmptyForm(),
    notes: "",
  });
  this.fetchBills();
};

  renderBillingTab = () => {
    const f = this.state.formData;
    const items = f.lineItems || [];
    return (
      <div>
        <div className="form-row">
          <div className="form-group col-md-2">
  <label>Bill Acc Type</label>
  <select
    className="form-control"
    value={f.billAccType}
    onChange={e => {
      const type = e.target.value;
      // If switching to Standard, clear manual billAccNo
      this.handleInputChange("billAccType", type);
      if (type === "Standard") {
        this.handleInputChange("billAccNo", "");
      }
    }}
  >
    <option value="Standard">Standard (Auto)</option>
    <option value="Manual">Manual (Typing)</option>
  </select>
</div>
<div className="form-group col-md-2">
  <label>Bill Acc No</label>
  <input
    className="form-control"
    value={f.billAccNo}
    onChange={e => this.handleInputChange("billAccNo", e.target.value)}
    readOnly={f.billAccType === "Standard"}
    placeholder={f.billAccType === "Standard" ? "Auto" : "Enter Bill Acc No"}
  />
</div>
          <div className="form-group col-md-2">
            <label>Bill Acc Date</label>
            <input
              type="date"
              className="form-control"
              value={f.billAccDate}
              onChange={(e) => this.handleInputChange("billAccDate", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Status</label>
            <input className="form-control" value={f.status} readOnly />
          </div>
          <div className="form-group col-md-4">
          <label>Supplier Code & Name</label>
          <input
            className="form-control"
            value={`${f.supplierCode}-${f.supplierName}`} 
            readOnly
            onClick={this.showSupplierOverlay}
            style={{ cursor: "pointer" }}
            placeholder="Select Supplier"
          />
        </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Supplier Invoice No</label>
            <input  
              type="number"
              className="form-control"
              value={f.supplierInvoiceNo}
              onChange={(e) => this.handleInputChange("supplierInvoiceNo", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Supplier Invoice Date</label>
            <input
              type="date"
              className="form-control"
              value={f.supplierInvoiceDate}
              onChange={(e) => this.handleInputChange("supplierInvoiceDate", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Currency</label>
            <input className="form-control" value={f.currency} readOnly />
          </div>
          <div className="form-group col-md-2">
            <label>Conversion Rate</label>
            <input
              type="number"
              className="form-control"
              value={f.conversionRate}
              onChange={(e) => this.handleInputChange("conversionRate", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Payment Terms</label>
            <input
              className="form-control"
              value={f.paymentTerms}
              onChange={(e) => this.handleInputChange("paymentTerms", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Due Date</label>
            <input
              type="date"
              className="form-control"
              value={f.dueDate}
              onChange={(e) => this.handleInputChange("dueDate", e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-2">
            <label>Payment Release Date</label>
            <input
              type="date"
              className="form-control"
              value={f.paymentReleaseDate}
              onChange={(e) => this.handleInputChange("paymentReleaseDate", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>Actual Payment Amount</label>
            <input
              type="number"
              className="form-control"
              value={f.actualPaymentAmount}
              onChange={(e) => this.handleInputChange("actualPaymentAmount", e.target.value)}
            />
          </div>
          <div className="form-group col-md-2">
            <label>TDS Amount/15 CA/CB Doc</label>
            <input
              type="number" 
              className="form-control"
              value={f.tdsAmount}
              onChange={(e) => this.handleInputChange("tdsAmount", e.target.value)}
            />
          </div>
         
          <div className="form-group col-md-2">
            <label>Total Invoice Value</label>
            <input className="form-control" value={f.totalInvoiceValue} readOnly />
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
                <th>UOM</th>
                <th>Item Type</th>
                <th>Material Type</th>
                <th>Total Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{it.itemCode}</td>
                  <td>{it.itemDesc}</td>
                  <td>{it.uom}</td>
                  <td>
                    <input
                      className="form-control"
                      value={it.itemType}
                      onChange={(e) =>
                        this.handleLineItemChange(i, "itemType", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="form-control"
                      value={it.materialType}
                      onChange={(e) =>
                        this.handleLineItemChange(i, "materialType", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-control"
                      value={it.totalUnitPrice}
                      onChange={(e) =>
                        this.handleLineItemChange(i, "totalUnitPrice", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">
                    No items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
          onChange={(e) => this.setState({ notes: e.target.value })}
          style={{ resize: "vertical", minHeight: "40px", maxHeight: "120px" }}
        />
      </div>
    </div>
  );

  renderTabs = () => {
    const tabs = ["Billing Details", "Notes"];
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
    const filtered = suppliers.filter((s) =>
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
            onChange={(e) => this.setState({ supplierOverlaySearch: e.target.value })}
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
                  <tr
                    key={s.id || i}
                    onClick={() => this.selectSupplier(s)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{s.spCode}</td>
                    <td>{s.spName}</td>
                    <td>{s.spshortName}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center">
                      No suppliers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-2"
            onClick={this.hideSupplierOverlay}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  renderProductOverlay = () => {
    const { products, productOverlaySearch, selectedProductIds } = this.state;
    const filtered = products.filter((p) =>
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
            onChange={(e) => this.setState({ productOverlaySearch: e.target.value })}
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
                        onChange={(e) =>
                          this.toggleProductSelection(p.id, e.target.checked)
                        }
                      />
                    </td>
                    <td>{p.productId}</td>
                    <td>{p.ptshortName}</td>
                    <td>{p.ptdescription}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center">
                      No products found
                    </td>
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
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <h4 className="mb-3">Third Party Billing</h4>
            {this.renderTabs()}
            {this.state.activeTab === 0 && this.renderBillingTab()}
            {this.state.activeTab === 1 && this.renderNotesTab()}
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
        {this.state.showSupplierOverlay && this.renderSupplierOverlay()}
        {this.state.showProductOverlay && this.renderProductOverlay()}
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Third Party Bills</h4>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => this.setState({ showForm: true })}
          >
            Create
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="thead-light">
              <tr>
                <th>Bill Acc No</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Supplier Invoice No</th>
                <th>Currency</th>
                <th>Total Invoice Value</th>
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
                      {b.billAccNo}
                    </button>
                  </td>
                  <td>{b.billAccDate}</td>
                  <td>{b.supplierName}</td>
                  <td>{b.supplierInvoiceNo}</td>
                  <td>{b.currency}</td>
                  <td>{b.totalInvoiceValue}</td>
                  <td>{b.status}</td>
                </tr>
              ))}
              {this.state.bills.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center">
                    No records found
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

export default ThirdPartyBilling;