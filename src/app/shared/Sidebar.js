import React, { Component } from 'react';
import { Link, withRouter } from 'react-router-dom';
import { Collapse } from 'react-bootstrap';
import { Dropdown } from 'react-bootstrap';
import { Trans } from 'react-i18next';
import { db } from '../../firebase';
import { collection,getDocs } from 'firebase/firestore';


class Sidebar extends Component {
  state = {
    businessGroup: null,
  };

  toggleMenuState(menuState) {
  this.setState(prevState => {
    const newState = { ...prevState };

    // If clicking the same menu, just toggle
    if (newState[menuState]) {
      newState[menuState] = false;
    } else {
      Object.keys(newState).forEach(key => {
        // Keep parent menus open
        if (
          key !== 'inventoryOpen' && 
          key !== 'invmasterOpen' && 
          key !== 'invstockdetailsOpen' && 
          key !== 'invreportOpen' && 
          key !== 'salesOpen' && 
          key !== 'salesMastersOpen' && 
          key !== 'salesTransactionsOpen' && 
          key !== 'salesQuoteOpen' && 
          key !== 'salesOrderOpen' &&
          key !== 'salesInvoiceOpen' &&
          key !== 'salesContractOpen' &&
          key !== 'salescbOpen' &&
          key !== 'salesidOpen' && 
          key !== 'salestpOpen' 
        ) {
          newState[key] = false;
        }
      });
      newState[menuState] = true;
    }

    // Always ensure parent menus stay open
    if (
      menuState === 'invmasterOpen' || 
      menuState === 'invstockdetailsOpen' || 
      menuState === 'invreportOpen'
    ) {
      newState.inventoryOpen = true;
    }
    if (
      menuState === 'salesMastersOpen' || 
      menuState === 'salesTransactionsOpen' || 
      menuState === 'salesQuoteOpen' || 
      menuState === 'salesOrderOpen'||
      menuState === 'salesInvoiceOpen'||
      menuState === 'salesContractOpen'||
      menuState ==='salescbOpen'||
      menuState === 'salesidOpen'|| 
      menuState === 'salestpOpen'
    ) {
      newState.salesOpen = true;
    }

    return newState;
  });
}


  componentDidUpdate(prevProps) {
    if (this.props.location !== prevProps.location) {
      this.onRouteChanged();
    }
  }
onRouteChanged() {
  document.querySelector('#sidebar').classList.remove('active');

  const menuStates = [
    'appsMenuOpen', 'formsOpen', 'inventoryOpen', 'basicUiMenuOpen',
    'salesOpen', 'salesMastersOpen', 'salesTransactionsOpen',
    'salesQuoteOpen', 'salesOrderOpen','salesInvoiceOpen','salesContractOpen','salescbOpen','salesidOpen','salestpOpen',
    'purchaseOpen', 'adminOpen', 'formElementsMenuOpen',
    'tablesMenuOpen', 'iconsMenuOpen', 'chartsMenuOpen',
    'userPagesMenuOpen', 'errorPagesMenuOpen'
  ];
  menuStates.forEach(i => {
    this.setState({ [i]: false });
  });

  const dropdownPaths = [
    { path: '/apps', state: 'appsMenuOpen' },
    { path: '/forms', state: 'formsOpen' },
    { path: '/crm', state: 'crmOpen' },
    { path: '/inventory', state: 'inventoryOpen' },
    { path: '/inventory/invmaster', state: 'invmasterOpen' },
    { path: '/inventory/invstockdetails', state: 'invstockdetailsOpen' },
    { path: '/inventory/invreport', state: 'invreportOpen' },
    { path: '/basic-ui', state: 'basicUiMenuOpen' },
    { path: '/sales', state: 'salesOpen' },
    { path: '/sales/salesmasters', state: 'salesMastersOpen' },
    { path: '/sales/salestransactions', state: 'salesTransactionsOpen' },
    { path: '/sales/salestransactions/quote', state: 'salesQuoteOpen' },
    { path: '/sales/salestransactions/order', state: 'salesOrderOpen' },
    { path: '/sales/salestransactions/invoice', state: 'salesInvoiceOpen' },
    { path: '/sales/salestransactions/invoice/cbill', state: 'salescbOpen' },
    { path: '/sales/salestransactions/invoice/idbill', state: 'salesidOpen' },
     { path: '/sales/salestransactions/invoice/tpbill', state: 'salestpOpen' },
    { path: '/sales/salestransactions/contract', state: 'salesContractOpen' },
    { path: '/administrator', state: 'adminOpen' },
    { path: '/purchase', state: 'purchaseOpen' },
    { path: '/form-elements', state: 'formElementsMenuOpen' },
    { path: '/tables', state: 'tablesMenuOpen' },
    { path: '/icons', state: 'iconsMenuOpen' },
    { path: '/charts', state: 'chartsMenuOpen' },
    { path: '/user-pages', state: 'userPagesMenuOpen' },
    { path: '/error-pages', state: 'errorPagesMenuOpen' }
  ];

  dropdownPaths.forEach(obj => {
    if (this.isPathActive(obj.path)) {
      this.setState({ [obj.state]: true });
    }
  });
}

  render () {
    return (
      <nav className="sidebar sidebar-offcanvas" id="sidebar">
       <div className="sidebar-brand-wrapper d-flex flex-column align-items-center justify-content-center" style={{ height: 120 }}>
  {this.state.businessGroup && (
    <>
      {/* Sidebar collapsed: show shortName as text */}
      {document.body.classList.contains('sidebar-icon-only') ? (
        <span
          style={{
            fontWeight: 700,
            fontSize: 24,
            color: '#fff',
            letterSpacing: 1,
            textAlign: 'center'
          }}
        >
          {this.state.businessGroup.shortName || 'Co'}
        </span>
      ) : (
        // Sidebar expanded: show logo and shortName
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {this.state.businessGroup.logoUrl && (
            <img
              src={this.state.businessGroup.logoUrl}
              alt="logo"
              style={{
                height: 100,
                width: 100,
                objectFit: 'contain',
                borderRadius: 8
              }}
            />
          )}
          <span
            style={{
              fontWeight: 700,
              fontSize: 20,
              color: '#fff',
              letterSpacing: 1
            }}
          >
            {this.state.businessGroup.shortName}
          </span>
        </div>
      )}
    </>
  )}
</div>

        <ul className="nav">
      
          <li className={ this.isPathActive('/dashboard') ? 'nav-item active' : 'nav-item' }>
            <Link className="nav-link" to="/dashboard">
              <i className="mdi mdi-television menu-icon"></i>
              <span className="menu-title"><Trans>Dashboard</Trans></span>
            </Link>
          </li>
          <li className={ this.isPathActive('/crm') ? 'nav-item active' : 'nav-item' }>
            <div className={ this.state.crmOpen ? 'nav-link menu-expanded' : 'nav-link' } onClick={ () => this.toggleMenuState('crmOpen') } data-toggle="collapse">
              <i className="mdi mdi-cart-outline menu-icon"></i>
              <span className="menu-title"><Trans>CRM</Trans></span>
              <i className="menu-arrow"></i>
            </div>
            <Collapse in={ this.state.crmOpen}>
              <ul className="nav flex-column sub-menu">
                <li className="nav-item"> <Link className={ this.isPathActive('/crm/Datalist') ? 'nav-link active' : 'nav-link' } to="/crm/Datalist"><Trans>Datalist</Trans></Link></li>
              </ul>
            </Collapse>
            <Collapse in={ this.state.crmOpen}>
              <ul className="nav flex-column sub-menu">
                <li className="nav-item"> <Link className={ this.isPathActive('/crm/Activity') ? 'nav-link active' : 'nav-link' } to="/crm/Activity"><Trans>Activity</Trans></Link></li>
              </ul>
            </Collapse>
          </li>
          <li className={ this.isPathActive('/inventory') ? 'nav-item active' : 'nav-item' }>
  {/* Inventory Main Toggle */}
  <div 
    className={ this.state.inventoryOpen ? 'nav-link menu-expanded' : 'nav-link' }
    onClick={ () => this.toggleMenuState('inventoryOpen') }
    data-toggle="collapse"
  >
    <i className="mdi mdi-poll menu-icon"></i>
    <span className="menu-title"><Trans>Inventory</Trans></span>
    <i className="menu-arrow"></i>
  </div>

  {/* Inventory Content */}
  <Collapse in={ this.state.inventoryOpen }>
    <ul className="nav flex-column sub-menu">

      {/* Masters Section */}
      <li className={ this.isPathActive('/inventory/invmaster') ? 'nav-item active' : 'nav-item' }>
        <div 
          className={ this.state.invmasterOpen ? 'nav-link menu-expanded' : 'nav-link' }
          onClick={ () => this.toggleMenuState('invmasterOpen') }
          data-toggle="collapse"
        >
          <span className="menu-title"><Trans>Masters</Trans></span>
          <i className="menu-arrow"></i>
        </div>
        <Collapse in={ this.state.invmasterOpen }>
          <ul className="nav flex-column sub-menu">
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/ProductMaster') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/ProductMaster"><Trans>Product Master</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/UOMPage') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/UOMPage"><Trans>UOM</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/PaymentTerms') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/PaymentTerms"><Trans>Payment Terms</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/LocationPage') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/LocationPage"><Trans>Location</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/WarehousePage') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/WarehousePage"><Trans>Warehouse</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/Locator') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/Locator"><Trans>Locator</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/Taxgroup') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/Taxgroup"><Trans>Tax Group</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/TaxComponent') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/TaxComponent"><Trans>Tax Component</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/CurrencyPage') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/CurrencyPage"><Trans>Currencies</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invmaster/DespatchMode') ? 'nav-link active' : 'nav-link' } to="/inventory/invmaster/DespatchMode"><Trans>Despatch Mode</Trans></Link></li>
          </ul>
        </Collapse>
      </li>

      {/* Stock Details Section */}
      <li className={ this.isPathActive('/inventory/invstockdetails') ? 'nav-item active' : 'nav-item' }>
        <div 
          className={ this.state.invstockdetailsOpen ? 'nav-link menu-expanded' : 'nav-link' }
          onClick={ () => this.toggleMenuState('invstockdetailsOpen') }
          data-toggle="collapse"
        >
          <span className="menu-title"><Trans>Stock details</Trans></span>
          <i className="menu-arrow"></i>
        </div>
        <Collapse in={ this.state.invstockdetailsOpen }>
          <ul className="nav flex-column sub-menu">
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invstockdetails/OpenStockUpdate') ? 'nav-link active' : 'nav-link' } to="/inventory/invstockdetails/OpenStockUpdate"><Trans>Open Stock Update</Trans></Link></li>
            <li className="nav-item"><Link className={ this.isPathActive('/inventory/invstockdetails/StockLedger') ? 'nav-link active' : 'nav-link' } to="/inventory/invstockdetails/StockLedger"><Trans>Stock Ledger</Trans></Link></li>
          </ul>
        </Collapse>
      </li>

      {/* Direct Report Link */}
      <li className="nav-item">
        <Link className={ this.isPathActive('/inventory/invreport') ? 'nav-link active' : 'nav-link' } to="/inventory/invreport">
          <span className="menu-title"><Trans>Report</Trans></span>
        </Link>
      </li>

    </ul>
  </Collapse>
</li>

          <li className={ this.isPathActive('/purchase') ? 'nav-item active' : 'nav-item' }>
            <div className={ this.state.purchaseOpen ? 'nav-link menu-expanded' : 'nav-link' } onClick={ () => this.toggleMenuState('purchaseOpen') } data-toggle="collapse">
              <i className="mdi mdi-cart-outline menu-icon"></i>
              <span className="menu-title"><Trans>Purchase</Trans></span>
              <i className="menu-arrow"></i>
            </div>
            <Collapse in={ this.state.purchaseOpen}>
              <ul className="nav flex-column sub-menu">
                <li className="nav-item"> <Link className={ this.isPathActive('/purchase/Supplier') ? 'nav-link active' : 'nav-link' } to="/purchase/Supplier"><Trans>Supplier</Trans></Link></li>
              </ul>
            </Collapse>
          </li>

          {/* Sales Menu */}
<li className={ this.isPathActive('/sales') ? 'nav-item active' : 'nav-item' }>
  <div 
    className={ this.state.salesOpen ? 'nav-link menu-expanded' : 'nav-link' }
    onClick={ () => this.toggleMenuState('salesOpen') }
    data-toggle="collapse"
  >
    <i className="mdi mdi-chart-line menu-icon"></i>
    <span className="menu-title"><Trans>Sales</Trans></span>
    <i className="menu-arrow"></i>
  </div>

  <Collapse in={ this.state.salesOpen }>
    <ul className="nav flex-column sub-menu">

      {/* Masters */}
      <li className={ this.isPathActive('/sales/salesmasters') ? 'nav-item active' : 'nav-item' }>
  <div
    className="nav-link"
    onClick={ () => this.toggleMenuState('salesMastersOpen') }
    data-toggle="collapse"
  >
    <span className="menu-title"><Trans>Masters</Trans></span>
    <i className="menu-arrow"></i>
  </div>
  <Collapse in={ this.state.salesMastersOpen }>
    <ul className="nav flex-column sub-menu">
      <li className="nav-item">
        <Link
          className={ this.isPathActive('/sales/salesmasters/CustomerPage') ? 'nav-link active' : 'nav-link' }
          to="/sales/salesmasters/CustomerPage"
        >
          <Trans>Customer</Trans>
        </Link>
      </li>
    </ul>
  </Collapse>
</li>


      {/* Transactions */}
      <li className={ this.isPathActive('/sales/salestransactions') ? 'nav-item active' : 'nav-item' }>
        <div 
          className={ this.state.salesTransactionsOpen ? 'nav-link menu-expanded' : 'nav-link' }
          onClick={ () => this.toggleMenuState('salesTransactionsOpen') }
          data-toggle="collapse"
        >
          <span className="menu-title"><Trans>Transactions</Trans></span>
          <i className="menu-arrow"></i>
        </div>

        <Collapse in={ this.state.salesTransactionsOpen }>
          <ul className="nav flex-column sub-menu">

            {/* Quote */}
            <li className={ this.isPathActive('/sales/salestransactions/quote') ? 'nav-item active' : 'nav-item' }>
              <div 
                className={ this.state.salesQuoteOpen ? 'nav-link menu-expanded' : 'nav-link' }
                onClick={ () => this.toggleMenuState('salesQuoteOpen') }
                data-toggle="collapse"
              >
                <span className="menu-title"><Trans>Quote</Trans></span>
                <i className="menu-arrow"></i>
              </div>
              <Collapse in={ this.state.salesQuoteOpen }>
                <ul className="nav flex-column sub-menu">
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/quote/Quote') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/quote/Quote"><Trans>Quote Creation</Trans></Link></li>
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/quote/QuoteApproval') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/quote/QuoteApproval"><Trans>Quote Approval</Trans></Link></li>
                </ul>
              </Collapse>
            </li>

            {/* Order */}
            <li className={ this.isPathActive('/sales/salestransactions/order') ? 'nav-item active' : 'nav-item' }>
              <div 
                className={ this.state.salesOrderOpen ? 'nav-link menu-expanded' : 'nav-link' }
                onClick={ () => this.toggleMenuState('salesOrderOpen') }
                data-toggle="collapse"
              >
                <span className="menu-title"><Trans>Order</Trans></span>
                <i className="menu-arrow"></i>
              </div>
              <Collapse in={ this.state.salesOrderOpen }>
                <ul className="nav flex-column sub-menu">
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/order/Order') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/order/Order"><Trans>Order Creation</Trans></Link></li>
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/order/OrderApproval') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/order/OrderApproval"><Trans>Order Approval</Trans></Link></li>
                </ul>
              </Collapse>
            </li>
            <li className={ this.isPathActive('/sales/salestransactions/invoice') ? 'nav-item active' : 'nav-item' }>
              <div 
                className={ this.state.salesInvoiceOpen ? 'nav-link menu-expanded' : 'nav-link' }
                onClick={ () => this.toggleMenuState('salesInvoiceOpen') }
                data-toggle="collapse"
              >
                <span className="menu-title"><Trans>Billing</Trans></span>
                <i className="menu-arrow"></i>
              </div>
              <Collapse in={ this.state.salesInvoiceOpen }>
                <ul className="nav flex-column sub-menu">
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/CustomerOrderBilling') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/CustomerOrderBilling"><Trans>Customer Order Billing</Trans></Link></li>
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/DirectBilling') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/DirectBilling"><Trans>Direct Billing</Trans></Link></li>
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/BillingApproval') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/BillingApproval"><Trans>Billing Approval</Trans></Link></li>
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/BillingAmendment') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/BillingAmendment"><Trans>Billing Amendment</Trans></Link></li>
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/BillingCancel') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/BillingCancel"><Trans>Billing Cancel</Trans></Link></li>
                  <li className={ this.isPathActive('/sales/salestransactions/invoice/cbill') ? 'nav-item active' : 'nav-item' }>
              <div 
                className={ this.state.salesOrderOpen ? 'nav-link menu-expanded' : 'nav-link' }
                onClick={ () => this.toggleMenuState('salescbOpen') }
                data-toggle="collapse"
              >
                <span className="menu-title"><Trans>Contract Billing</Trans></span>
                <i className="menu-arrow"></i>
              </div>
              <Collapse in={ this.state.salescbOpen }>
                <ul className="nav flex-column sub-menu">
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/cbill/contractfinalbill') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/cbill/contractfinalbill"><Trans>Contract Bill</Trans></Link></li>
                </ul>
              </Collapse>
            </li>
            <li className={ this.isPathActive('/sales/salestransactions/invoice/idbill') ? 'nav-item active' : 'nav-item' }>
              <div 
                className={ this.state.salesOrderOpen ? 'nav-link menu-expanded' : 'nav-link' }
                onClick={ () => this.toggleMenuState('salesidOpen') }
                data-toggle="collapse"
              >
                <span className="menu-title"><Trans>Indirect Billing</Trans></span>
                <i className="menu-arrow"></i>
              </div>
              <Collapse in={ this.state.salesidOpen }>
                <ul className="nav flex-column sub-menu">
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/idbill/IndirectBilling') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/idbill/IndirectBilling"><Trans>Indirect Billing</Trans></Link></li>
                </ul>
              </Collapse>
            </li>
            <li className={ this.isPathActive('/sales/salestransactions/invoice/tpbill') ? 'nav-item active' : 'nav-item' }>
              <div 
                className={ this.state.salesOrderOpen ? 'nav-link menu-expanded' : 'nav-link' }
                onClick={ () => this.toggleMenuState('salestpOpen') }
                data-toggle="collapse"
              >
                <span className="menu-title"><Trans>Third Party Billing</Trans></span>
                <i className="menu-arrow"></i>
              </div>
              <Collapse in={ this.state.salestpOpen }>
                <ul className="nav flex-column sub-menu">
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/tpbill/ThirdPartyBilling') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/tpbill/ThirdPartyBilling"><Trans>Third Party Billing</Trans></Link></li>
                </ul>
              </Collapse>
            </li>
            

                </ul>
              </Collapse>
            </li>
            <li className={ this.isPathActive('/sales/salestransactions/servicecontract') ? 'nav-item active' : 'nav-item' }>
              <div 
                className={ this.state.salesContractOpen ? 'nav-link menu-expanded' : 'nav-link' }
                onClick={ () => this.toggleMenuState('salesContractOpen') }
                data-toggle="collapse"
              >
                <span className="menu-title"><Trans>Contract</Trans></span>
                <i className="menu-arrow"></i>
              </div>
              <Collapse in={ this.state.salesContractOpen }>
                <ul className="nav flex-column sub-menu">
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/servicecontract/servicecontractbilling') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/servicecontract/servicecontractbilling"><Trans>Service Contract</Trans></Link></li>
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/servicecontract/contractapproval') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/servicecontract/contractapproval"><Trans>Service Contract Approval</Trans></Link></li>

                </ul>
              </Collapse>
            </li>

          </ul>
        </Collapse>
      </li>

    </ul>
  </Collapse>
</li>

          <li className={ this.isPathActive('/administrator') ? 'nav-item active' : 'nav-item' }>
  <Link className="nav-link" to="/administrator">
    <i className="mdi mdi-account-box-outline menu-icon"></i>
    <span className="menu-title"><Trans>Administrator</Trans></span>
  </Link>
</li>

           <li className="nav-item">
            <Link className="nav-link" to="/panelone/LeadForm">
              <i className="mdi mdi-percent menu-icon"></i>
              <span className="menu-title">Lead</span>
            </Link>
          </li>
          
           <li className="nav-item">
            <Link className="nav-link" to="/panelone/Quote">
              <i className="mdi mdi-percent menu-icon"></i>
              <span className="menu-title">Quote</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link" to="/panelone/Order">
              <i className="mdi mdi-file-check menu-icon"></i>
              <span className="menu-title">Order</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link" to="/panelone/Invoice">
              <i className="mdi mdi-file-check menu-icon"></i>
              <span className="menu-title">Invoice</span>
            </Link>
          </li>
         
         
        </ul>
      </nav>
    );
  }

  isPathActive(path) {
    return this.props.location.pathname.startsWith(path);
  }

async componentDidMount() {
  this.onRouteChanged();

  // Always listen for updates
  window.addEventListener('businessGroupUpdated', this.handleBusinessGroupUpdate);

  // Always load from localStorage
  const storedBG = localStorage.getItem('businessGroup');
  if (storedBG) {
    this.setState({ businessGroup: JSON.parse(storedBG) });
  } else {
    // Only fetch from Firestore if nothing in localStorage (first ever load)
    const snap = await getDocs(collection(db, 'businessGroups'));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (data[0]) {
      localStorage.setItem('businessGroup', JSON.stringify(data[0]));
      this.setState({ businessGroup: data[0] });
    }
  }

  // Sidebar hover behavior
  const body = document.querySelector('body');
  document.querySelectorAll('.sidebar .nav-item').forEach((el) => {
    el.addEventListener('mouseover', function () {
      if (body.classList.contains('sidebar-icon-only')) {
        el.classList.add('hover-open');
      }
    });
    el.addEventListener('mouseout', function () {
      if (body.classList.contains('sidebar-icon-only')) {
        el.classList.remove('hover-open');
      }
    });
  });

}

componentDidUpdate(prevProps) {
  if (this.props.location !== prevProps.location) {
    this.onRouteChanged();
    // Always reload business group from localStorage on navigation
    const storedBG = localStorage.getItem('businessGroup');
    if (storedBG) {
      this.setState({ businessGroup: JSON.parse(storedBG) });
    }
  }
}
componentWillUnmount() {
  window.removeEventListener('businessGroupUpdated', this.handleBusinessGroupUpdate);
}

handleBusinessGroupUpdate = () => {
  const storedBG = localStorage.getItem('businessGroup');
  if (storedBG) {
    this.setState({ businessGroup: JSON.parse(storedBG) });
  }
};
}

export default withRouter(Sidebar);