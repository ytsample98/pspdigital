import React, { Component } from 'react';
import { db } from '../../../firebase';import { getDocs,query, where } from 'firebase/firestore';
import { collection, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import '../../../assets/styles/components/_custom-table.scss';



const ITEM_TYPES = ['Raw Material', 'Finished Goods', 'Packing Material'];
const MATERIAL_TYPES_PRODUCT = ['Purchase', 'Manufacturing', 'By Product'];
const MATERIAL_TYPES_SERVICE = ['Outsource','Internal','External'];
const MATERIAL_TYPES_NONPROD = ['Stationery', 'Consumables', 'Maintenance']; 

class ProductMaster extends Component {
  state = {
    products: [],
    showForm: false,
    editingId: null,
    activeTab: 'item',
    formData: {
      productId: '',
      ptshortName: '',//
      ptdescription: '',//
      ptrefNo: '',//
      hsnCode: '',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      category:'Product',
            itemType: 'Raw Material',
      materialType: 'Purchase',
      buyingUOM: '',
      sellingUOM: '',
      stockingUOM: '',
      qcRequired: false,
      minMaxPlan: false,
      minQty: '',
      maxQty: '',
      warehouse: '',
      attachmentFile: null,
      attachmentDesc: '',
      xlDesc: ''
    },
    showUOMOverlay: false,
    uomField: '',
    uoms: [],
    uomSearch: '',
    showWarehouseOverlay: false,
    showLocatorOverlay: false,
    warehouseList: [],
    locatorList: [],
    selectedWarehouseId: null,
  };

  componentDidMount() {
    this.fetchProducts();
    this.fetchUOMs();
  }
showWarehouseOverlay = async () => {
  const snap = await getDocs(collection(db, 'warehouses'));
  const warehouseList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  this.setState({ warehouseList, showWarehouseOverlay: true });
};

showLocatorOverlay = async () => {
  const { selectedWarehouseId } = this.state;
  if (!selectedWarehouseId) return alert('Please select a warehouse first.');

  const snap = await getDocs(
    query(collection(db, 'locators'), where('warehouseId', '==', selectedWarehouseId))
  );
  const locatorList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  this.setState({ locatorList, showLocatorOverlay: true });
  console.log('Fetched locators:', locatorList);

};

  fetchProducts = async () => {
    const snap = await getDocs(collection(db, 'products'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ products: data });
  };
fetchUOMs = async () => {
  // Fetch from Firestore "uoms" collection (or whatever your UOM collection is named)
  const snap = await getDocs(collection(db, 'uoms'));
  const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  this.setState({ uoms: data });
};

  toggleForm = (edit = null) => {
    if (edit) {
      this.setState({ showForm: true, editingId: edit.id, activeTab: 'item', formData: { ...edit } });
    } else {
      this.setState({
        showForm: true,
        editingId: null,
        activeTab: 'item',
        formData: {
          productId: '',
          ptshortName: '',
          ptdescription: '',
          ptrefNo: '',
          hsnCode: '',
          effectiveFrom: new Date().toISOString().split('T')[0],
          effectiveTo: '',
          category:'Product',
          itemType: 'Raw Material',
          materialType: 'Purchase',
          buyingUOM: '',
          sellingUOM: '',
          stockingUOM: '',
          qcRequired: false,
          minMaxPlan: false,
          minQty: '',
          maxQty: '',
          warehouse: '',
          attachmentFile: null,
          attachmentDesc: '',
          xlDesc: ''
        }
      });
    }
  };

  handleChange = (field, value) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: value }
    }));
  };

  handleCheckbox = (field) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [field]: !prev.formData[field] }
    }));
  };

  handleUOMSelect = (field) => {
    this.setState({ showUOMOverlay: true, uomField: field, uomSearch: '' });
  };

  selectUOM = (name) => {
    this.setState(prev => ({
      formData: { ...prev.formData, [prev.uomField]: name },
      showUOMOverlay: false,
      uomField: '',
      uomSearch: ''
    }));
  };

 handleFileChange = (e) => {
  this.setState(prev => ({
    formData: { ...prev.formData, attachmentFile: Array.from(e.target.files) }
  }));
};

handleSubmit = async (e, mode = "save") => {
  e.preventDefault();
  const { editingId, formData, products } = this.state;

  if (!formData.ptshortName) return alert("Enter short name");

  // auto-generate productId if new
  if (!formData.productId) {
    if (formData.category === 'Service') {
      formData.productId = `SV${100 + products.length}`;
    } else if (formData.category === 'Non-Production') {
      formData.productId = `NP${100 + products.length}`;
    } else {
      formData.productId = `PD${100 + products.length}`;
    }
  }

  if (editingId) {
    await setDoc(doc(db, 'products', editingId), formData);
  } else {
    await addDoc(collection(db, 'products'), formData);
  }

  if (mode === "next") {
    // reset form but keep form open
    this.setState({
      editingId: null,
      formData: {
        productId: '',
        ptshortName: '',
        ptdescription: '',
        ptrefNo: '',
        hsnCode: '',
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: '',
        category: 'Product', // default again
        itemType: 'Raw Material',
        materialType: 'Purchase',
        buyingUOM: '',
        sellingUOM: '',
        stockingUOM: '',
        qcRequired: false,
        minMaxPlan: false,
        minQty: '',
        maxQty: '',
        warehouse: '',
        attachmentFile: null,
        attachmentDesc: '',
        xlDesc: ''
      }
    });
    this.fetchProducts(); // refresh table in background
  } else {
    // normal save → close form
    this.setState({ showForm: false, editingId: null });
    this.fetchProducts();
  }
};


  handleDelete = async (id) => {
    await deleteDoc(doc(db, 'products', id));
    this.fetchProducts();
  };

  renderUOMOverlay = () => {
    const { uoms, uomSearch } = this.state;
    return (
      <div className="custom-overlay">
        <div className="custom-overlay-content">
          <div className="custom-overlay-title">Select UOM</div>
          <div className="custom-search-bar">
            <input
              type="text"
              className="form-control"
              placeholder="Search UOM..."
              value={uomSearch}
              onChange={e => this.setState({ uomSearch: e.target.value })}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ul className="list-group">
              {uoms
                .filter(u => u.name.toLowerCase().includes((uomSearch || '').toLowerCase()))
                .map((u, i) => (
                  <li key={i} className="list-group-item list-group-item-action"
                    onClick={() => this.selectUOM(u.name)}>
                    {u.name}
                  </li>
                ))}
            </ul>
          </div>
          <button className="btn btn-secondary mt-3 align-self-end" onClick={() => this.setState({ showUOMOverlay: false })}>Cancel</button>
        </div>
      </div>
    );
  };
  renderWarehouseOverlay = () => {
  const { warehouseList, warehouseSearch = '' } = this.state;
  return (
    <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="custom-overlay-title">Select Warehouse</div>
        <div className="custom-search-bar">
          <input
            type="text"
            className="form-control"
            placeholder="Search Warehouse..."
            value={warehouseSearch}
            onChange={e => this.setState({ warehouseSearch: e.target.value })}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ul className="list-group">
            {warehouseList
              .filter(w => w.name.toLowerCase().includes((warehouseSearch || '').toLowerCase()))
              .map((w, i) => (
                <li
                  key={i}
                  className="list-group-item list-group-item-action"
                  onClick={() =>
                  this.setState(prev => ({
                    formData: {
                      ...prev.formData,
                      warehouse: w.code,          
                      warehouseName: w.name,    
                      locator: '',
                      locatorName: ''
                    },
                    selectedWarehouseId: w.code, 
                    showWarehouseOverlay: false
                  }))

                  }
                >
                  {w.name}
                </li>
              ))}
          </ul>
        </div>
        <button className="btn btn-secondary mt-3 align-self-end" onClick={() => this.setState({ showWarehouseOverlay: false })}>Cancel</button>
      </div>
    </div>
  );
};

renderLocatorOverlay = () => {
  const { locatorList, locatorSearch = '' } = this.state;
  return (
    <div className="custom-overlay">
      <div className="custom-overlay-content">
        <div className="custom-overlay-title">Select Locator</div>
        <div className="custom-search-bar">
          <input
            type="text"
            className="form-control"
            placeholder="Search Locator..."
            value={locatorSearch}
            onChange={e => this.setState({ locatorSearch: e.target.value })}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ul className="list-group">
            {locatorList
              .filter(l => l.name.toLowerCase().includes((locatorSearch || '').toLowerCase()))
              .map((l, i) => (
                <li
                  key={i}
                  className="list-group-item list-group-item-action"
                  onClick={() =>
                    this.setState(prev => ({
                      formData: {
                        ...prev.formData,
                        locator: l.code,
                        locatorName: l.name
                      },
                      showLocatorOverlay: false
                    }))
                  }
                >
                  {l.name}
                </li>
              ))}
          </ul>
        </div>
        <button className="btn btn-secondary mt-3 align-self-end" onClick={() => this.setState({ showLocatorOverlay: false })}>Cancel</button>
      </div>
    </div>
  );
};


  renderForm = () => {
    const { formData, activeTab, showUOMOverlay } = this.state;
    return (
      <div className="card full-height">
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <h4 className="mb-3">Product Master</h4>
        {/* Tabs */}
        <ul className="nav nav-tabs" role="tablist">
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === 'item' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'item' })}>Item Details</button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === 'warehouse' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'warehouse' })}>Warehouse & Store Locator</button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === 'attach' ? 'active' : ''}`} onClick={() => this.setState({ activeTab: 'attach' })}>Attachments</button>
          </li>
          
        </ul>
        <form className="form-sample mt-3" onSubmit={this.handleSubmit} autoComplete="off">
          {activeTab === 'item' && (
            <>
              <div className="form-row">
                <div className="form-group col-md-3">
                  <label>Item Code</label>
                  <input className="form-control form-control-sm" value={formData.productId || 'Auto'} readOnly />
                </div>
                <div className="form-group col-md-3">
                  <label>Short Name <span style={{ color: 'red' }}>*</span></label>
                  <input className="form-control form-control-sm" value={formData.ptshortName} onChange={e => this.handleChange('ptshortName', e.target.value)} required />
                </div>
                <div className="form-group col-md-6">
                  <label>Description</label>
                  <input className="form-control form-control-sm" value={formData.ptdescription} onChange={e => this.handleChange('ptdescription', e.target.value)} />
                </div>
                
              </div>
              <div className="form-row">
                <div className="form-group col-md-3">
                  <label>Ref No</label>
                  <input className="form-control form-control-sm" value={formData.ptrefNo} onChange={e => this.handleChange('ptrefNo', e.target.value)} />
                </div>
                <div className="form-group col-md-2">
                  <label>Effective From</label>
                  <input className="form-control form-control-sm" type="date" value={formData.effectiveFrom} onChange={e => this.handleChange('effectiveFrom', e.target.value)} />
                </div>
                <div className="form-group col-md-2">
                  <label>Effective To</label>
                  <input className="form-control form-control-sm" type="date" value={formData.effectiveTo} onChange={e => this.handleChange('effectiveTo', e.target.value)} />
                </div>
              <div className="form-group col-md-4 d-flex align-items-center">
  <div className="form-check mr-3">
    <input
      className="form-check-input"
      type="checkbox"
      checked={formData.category === 'Product'}
      onChange={() => this.handleChange('category', 'Product')}
      id="catProduct"
    />
    <label className="form-check-label" htmlFor="catProduct">Product</label>
  </div>
  <div className="form-check mr-3">
    <input
      className="form-check-input"
      type="checkbox"
      checked={formData.category === 'Service'}
      onChange={() => this.handleChange('category', 'Service')}
      id="catService"
    />
    <label className="form-check-label" htmlFor="catService">Service</label>
  </div>
  <div className="form-check">
    <input
      className="form-check-input"
      type="checkbox"
      checked={formData.category === 'Non-Production'}
      onChange={() => this.handleChange('category', 'Non-Production')}
      id="catNonProd"
    />
    <label className="form-check-label" htmlFor="catNonProd">Non-Production</label>
  </div>
</div>

              </div>
              <div className="form-row">
                 <div className="form-group col-md-3">
                  <label>HSN/SAC Code</label>
                  <input className="form-control form-control-sm" value={formData.hsnCode} onChange={e => this.handleChange('hsnCode', e.target.value)} />
                </div>
                {formData.category === 'Product' && (
  <>
    <div className="form-group col-md-3">
      <label>Material Type</label>
      <select
        className="form-control form-control-sm"
        value={formData.materialType}
        onChange={e => this.handleChange('materialType', e.target.value)}
      >
        {MATERIAL_TYPES_PRODUCT.map(type => <option key={type}>{type}</option>)}
      </select>
    </div>
    <div className="form-group col-md-3">
      <label>Item Type</label>
      <select
        className="form-control form-control-sm"
        value={formData.itemType}
        onChange={e => this.handleChange('itemType', e.target.value)}
      >
        {ITEM_TYPES.map(type => <option key={type}>{type}</option>)}
      </select>
    </div>
  </>
)}

{formData.category === 'Service' && (
  <div className="form-group col-md-3">
    <label>Material Type</label>
    <select
      className="form-control form-control-sm"
      value={formData.materialType}
      onChange={e => this.handleChange('materialType', e.target.value)}
    >
      {MATERIAL_TYPES_SERVICE.map(type => <option key={type}>{type}</option>)}
    </select>
  </div>
)}

{formData.category === 'Non-Production' && (
  <div className="form-group col-md-3">
    <label>Material Type</label>
    <select
      className="form-control form-control-sm"
      value={formData.materialType}
      onChange={e => this.handleChange('materialType', e.target.value)}
    >
      {MATERIAL_TYPES_NONPROD.map(type => <option key={type}>{type}</option>)}
    </select>
  </div>
)}

              </div>
              <div className="form-row">
  {/* First main column for UOM fields */}
  <div className="form-group col-md-4"> 
    <div className="form-group">
      <label>Buying UOM</label>
      <div className="input-group input-group-sm">
        <input className="form-control" value={formData.buyingUOM} readOnly onClick={() => this.handleUOMSelect('buyingUOM')} style={{ background: '#f8f9fa', cursor: 'pointer' }} />
        <div className="input-group-append">
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => this.handleUOMSelect('buyingUOM')}>Select</button>
        </div>
      </div>
    </div>
    <div className="form-group">
      <label>Selling UOM</label>
      <div className="input-group input-group-sm">
        <input className="form-control" value={formData.sellingUOM} readOnly onClick={() => this.handleUOMSelect('sellingUOM')} style={{ background: '#f8f9fa', cursor: 'pointer' }} />
        <div className="input-group-append">
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => this.handleUOMSelect('sellingUOM')}>Select</button>
        </div>
      </div>
    </div>
    <div className="form-group">
      <label>Stocking UOM</label>
      <div className="input-group input-group-sm">
        <input className="form-control" value={formData.stockingUOM} readOnly onClick={() => this.handleUOMSelect('stockingUOM')} style={{ background: '#f8f9fa', cursor: 'pointer' }} />
        <div className="input-group-append">
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => this.handleUOMSelect('stockingUOM')}>Select</button>
        </div>
      </div>
    </div>
  </div>
  {/* Second main column for other fields */}
  <div className="form-group col-md-8">
    <div className="form-row">
      <div className="form-group col-md-4">
        <div className="form-check">
          <input className="form-check-input" type="checkbox" checked={formData.qcRequired} onChange={() => this.handleCheckbox('qcRequired')} id="qcRequired" />
          <label className="form-check-label" htmlFor="qcRequired">QC Required</label>
        </div>
      </div>
      <div className="form-group col-md-4">
        <div className="form-check">
          <input className="form-check-input" type="checkbox" checked={formData.minMaxPlan} onChange={() => this.handleCheckbox('minMaxPlan')} id="minMaxPlan" />
          <label className="form-check-label" htmlFor="minMaxPlan">Min Max Plan</label>
        </div>
      </div>
    </div>
    <div className="form-row">
      <div className="form-group col-md-4">
        <label>Min Qty</label>
        <input className="form-control form-control-sm" type="number" value={formData.minQty} disabled={!formData.minMaxPlan} onChange={e => this.handleChange('minQty', e.target.value)} />
      </div>
      <div className="form-group col-md-4">
        <label>Max Qty</label>
        <input className="form-control form-control-sm" type="number" value={formData.maxQty} disabled={!formData.minMaxPlan} onChange={e => this.handleChange('maxQty', e.target.value)} />
      </div>
    </div>
  </div>
</div>
            </>
          )}
          {activeTab === 'warehouse' && (
  <div className="form-row">
    {/* Warehouse Selection */}
    <div className="form-group col-md-6">
      <label>Warehouse</label>
      <div className="input-group input-group-sm">
        <input
          className="form-control"
          value={formData.warehouseName}
          readOnly
          placeholder="Select Warehouse"
          onClick={this.showWarehouseOverlay}
          style={{ backgroundColor: '#f8f9fa', cursor: 'pointer' }}
        />
      </div>
    </div>

    {/* Locator Selection */}
    <div className="form-group col-md-6">
      <label>Locator</label>
      <div className="input-group input-group-sm">
        <input
          className="form-control"
          value={formData.locatorName}
          readOnly
          placeholder="Select Locator"
          onClick={this.showLocatorOverlay}
          style={{ backgroundColor: '#f8f9fa', cursor: 'pointer' }}
        />
      </div>
    </div>
  </div>
)}

          {activeTab === 'attach' && (
            <div className="form-row">
              <div className="form-group col-md-4">
                <label>Choose File</label>
                <input className="form-control-file" type="file" multiple onChange={this.handleFileChange} />
              </div>
              <div className="form-group col-md-8">
                <label>Description of Given File</label>
                <input className="form-control form-control-sm" value={formData.attachmentDesc} onChange={e => this.handleChange('attachmentDesc', e.target.value)} />
              </div>
            </div>
          )}
          <div className="fixed-card-footer d-flex justify-content-between">
  {/* Left side: Cancel */}
  <button 
    type="button" 
    className="btn btn-secondary btn-sm" 
    onClick={() => this.setState({ showForm: false })}
  >
    Cancel
  </button>

  {/* Right side: Save + Save & Next */}
  <div>
    <button 
      type="submit" 
      className="btn btn-outline-primary btn-sm mr-2"
      onClick={(e) => this.handleSubmit(e, "save")}
    >
      Save
    </button>
    <button 
      type="submit" 
      className="btn btn-primary btn-sm"
      onClick={(e) => this.handleSubmit(e, "next")}
    >
      Save & Next
    </button>
  </div>
</div>

        </form>
        {showUOMOverlay && this.renderUOMOverlay()}
      </div>
      </div>
    );
  };

  renderTable = () => (
    <div className="card mt-4 full-height">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="card-title">Product Master</h4>
          <button className="btn btn-primary btn-sm" onClick={() => this.toggleForm()}>+ Add Product</button>
        </div>
        <div className="custom-table-responsive">
        <table className="table table-bordered table-sm">
          <thead className='thead-light'>
            <tr>
              <th>Item Code</th>
              <th>Short Name</th>
              <th>Ref No</th>
              <th>Item Type</th>
              <th>Material Type</th>
              <th>HSN No</th>
              <th>Effective From</th>
              <th>Effective To</th>
              <th>QC</th>
              <th>Min Max Plan</th>
            </tr>
          </thead>
          <tbody>
            {this.state.products.map((p, i) => (
              <tr key={p.id}>
                <td><button className='btn btn-link p-0' onClick={() => this.toggleForm(p)}>{p.productId}</button></td>
                <td>{p.ptshortName}</td>
                <td>{p.ptrefNo}</td>
                <td>{p.itemType || ''}</td>
                <td>{p.materialType || ''}</td>
                <td>{p.hsnCode}</td>
                <td>{p.effectiveFrom}</td>
                <td>{p.effectiveTo}</td>
                <td>{p.qcRequired ? 'Yes' : 'No'}</td>
                <td>{p.minMaxPlan ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {this.state.products.length === 0 && <tr><td colSpan="13" className="text-center">No records found</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );

  render() {
    return (
  <div className="container-fluid">
    {this.state.showForm
      ? this.renderForm()
      : this.renderTable()}

    {/* Add overlays here so they're always available */}
    {this.state.showUOMOverlay && this.renderUOMOverlay()}
    {this.state.showWarehouseOverlay && this.renderWarehouseOverlay()}
    {this.state.showLocatorOverlay && this.renderLocatorOverlay()}
  </div>
);

  }
}

export default ProductMaster;