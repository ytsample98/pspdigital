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
    currentUser: null
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
    const user = this.state.currentUser || (() => { try { return JSON.parse(localStorage.getItem('dcmsUser')); } catch(e){return null;} })();
    const allowedPages = (user && user.pages) ? user.pages : null;
    const can = (page) => { if (!allowedPages) return true; return allowedPages.includes(page); };

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


          {can('psclist') && (
            <li className={ this.isPathActive('/PSCList') ? 'nav-item active' : 'nav-item' }>
              <Link className="nav-link" to="/PSCList">
                <i className="mdi mdi-crop-portrait menu-icon"></i>
                <span className="menu-title"><Trans>Problem Solving Card</Trans></span>
              </Link>
            </li>
          )}

          {can('corrective') && (
            <li className={ this.isPathActive('/CorrectiveAction') ? 'nav-item active' : 'nav-item' }>
              <Link className="nav-link" to="/CorrectiveAction">
                <i className="mdi mdi-logout-variant menu-icon"></i>
                <span className="menu-title"><Trans>Containment Action</Trans></span>
              </Link>
            </li>
          )}

          {can('rootcause') && (
            <li className={ this.isPathActive('/RootCause') ? 'nav-item active' : 'nav-item' }>
              <Link className="nav-link" to="/RootCause">
                <i className="mdi mdi-chart-line menu-icon"></i>
                <span className="menu-title"><Trans>Root Cause Analysis</Trans></span>
              </Link>
            </li>
          )}

          {can('effect') && (
            <li className={ this.isPathActive('/EffectCheck') ? 'nav-item active' : 'nav-item' }>
              <Link className="nav-link" to="/EffectCheck">
                <i className="mdi mdi-check-circle-outline menu-icon"></i>
                <span className="menu-title"><Trans>Effectiveness Check</Trans></span>
              </Link>
            </li>
          )}

          
          {can('administrator') && (
            <li className={ this.isPathActive('/administrator') ? 'nav-item active' : 'nav-item' }>
              <Link className="nav-link" to="/administrator">
                <i className="mdi mdi-account-box-outline menu-icon"></i>
                <span className="menu-title"><Trans>Administrator</Trans></span>
              </Link>
            </li>
          )}

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

  // load current user from localStorage for permission checks
  try {
    const cu = localStorage.getItem('dcmsUser');
    if (cu) this.setState({ currentUser: JSON.parse(cu) });
  } catch (e) { /* ignore */ }

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