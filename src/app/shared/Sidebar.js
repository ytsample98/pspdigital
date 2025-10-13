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
          key !== 'salesRejectOpen' &&
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
      menuState === 'salesRejectOpen'||
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
    'salesQuoteOpen', 'salesOrderOpen','salesInvoiceOpen','salesContractOpen','salescbOpen','salesidOpen','salestpOpen','salesRejectOpen', 
    'pspOpen', 'adminOpen', 'formElementsMenuOpen',
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
    { path: '/sales/salestransactions/rejection', state: 'salesRejectOpen' },
    { path: '/administrator', state: 'adminOpen' },
    { path: '/psp', state: 'pspOpen' },
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
          <li className={ this.isPathActive('/psp') ? 'nav-item active' : 'nav-item' }>
            <div className={ this.state.pspOpen ? 'nav-link menu-expanded' : 'nav-link' } onClick={ () => this.toggleMenuState('pspOpen') } data-toggle="collapse">
              <i className="mdi mdi-cart-outline menu-icon"></i>
              <span className="menu-title"><Trans>Problem Solving Card</Trans></span>
              <i className="menu-arrow"></i>
            </div>
            <Collapse in={ this.state.pspOpen}>
              <ul className="nav flex-column sub-menu">
                <li className="nav-item"> <Link className={ this.isPathActive('/psp/pspform') ? 'nav-link active' : 'nav-link' } to="/psp/pspform"><Trans>Create PSC form</Trans></Link></li>
              </ul>
            </Collapse>
          </li>
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
               <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/idbill/IndirectBillingApproval') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/idbill/IndirectBillingApproval"><Trans>Indirect Billing Approval</Trans></Link></li>

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
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/invoice/tpbill/ThirdPartyBillingApproval') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/invoice/tpbill/ThirdPartyBillingApproval"><Trans>Third Party Billing Approval</Trans></Link></li>
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
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/servicecontract/servicecontractapproval') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/servicecontract/servicecontractapproval"><Trans>Service Contract Approval</Trans></Link></li>

                </ul>
              </Collapse>
            </li>
            <li className={ this.isPathActive('/sales/salestransactions/rejection') ? 'nav-item active' : 'nav-item' }>
              <div 
                className={ this.state.salesRejectOpen ? 'nav-link menu-expanded' : 'nav-link' }
                onClick={ () => this.toggleMenuState('salesRejectOpen') }
                data-toggle="collapse"
              >
                <span className="menu-title"><Trans>Rejection from Customer</Trans></span>
                <i className="menu-arrow"></i>
              </div>
              <Collapse in={ this.state.salesRejectOpen }>
                <ul className="nav flex-column sub-menu">
                  <li className="nav-item"><Link className={ this.isPathActive('/sales/salestransactions/rejection/rejectionfromcustomer') ? 'nav-link active' : 'nav-link' } to="/sales/salestransactions/rejection/rejectionfromcustomer"><Trans>Rej From Customer</Trans></Link></li>

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