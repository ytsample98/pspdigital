import React, { Component,Suspense, lazy } from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';

import Spinner from '../app/shared/Spinner';
import Taxgroup from './inventory/invmaster/Taxgroup';
import Locator from './inventory/invmaster/Locator';
import OrganizationPage from './administrator/OrganizationPage';

const Dashboard = lazy(() => import('./dashboard/Dashboard'));
const Register= lazy(() => import('./user-pages/Register'));
const Login = lazy(() => import('./user-pages/Login'));
const CustomerPage=lazy(()=> import('./sales/salesmasters/CustomerPage'));
const OrgPage=lazy(()=> import('./administrator/OrganizationPage'));
const UserCreation=lazy(()=> import('./administrator/UserCreation'));
const AdminMediaList=lazy(()=> import('./administrator/AdminPage'));
const LeadForm=lazy(()=> import('./panelone/LeadForm'));
const Order=lazy(()=> import('./sales/salestransactions/order/Order'));
const OrderApproval=lazy(()=> import('./sales/salestransactions/order/OrderApproval'));
const Quote=lazy(()=> import('./sales/salestransactions/quote/Quote'));
const QuoteApproval=lazy(()=> import('./sales/salestransactions/quote/QuoteApproval'));
const Invoice=lazy(()=> import('./sales/salestransactions/invoice/Invoice'));
const CustomerOrderBilling=lazy(()=> import('./sales/salestransactions/invoice/CustomerOrderBilling'));
const BillingApproval=lazy(()=> import('./sales/salestransactions/invoice/BillingApproval'));
const BillingAmendment=lazy(()=> import('./sales/salestransactions/invoice/BillingAmendment'));
const BillingCancel=lazy(()=> import('./sales/salestransactions/invoice/BillingCancel'));
const ContractFinalBilling=lazy(()=> import('./sales/salestransactions/invoice/cbill/contractfinalbill'));
const ContractBilling=lazy(()=> import('./sales/salestransactions/servicecontract/servicecontractbilling'));
const contractapproval=lazy(()=> import('./sales/salestransactions/servicecontract/contractapproval'));
const DirectBilling=lazy(()=> import('./sales/salestransactions/invoice/DirectBilling'));
const IndirectBilling=lazy(()=> import('./sales/salestransactions/invoice/idbill/IndirectBilling'));
const ThirdPartyBilling=lazy(()=> import('./sales/salestransactions/invoice/tpbill/ThirdPartyBilling'));
const Supplier=lazy(()=> import('./purchase/Supplier'));
const ProductMaster= lazy(() => import('./inventory/invmaster/ProductMaster'));
const UOMPage = lazy(() => import('./inventory/invmaster/UOMPage'));
const Payment= lazy(() => import('./inventory/invmaster/PaymentTerms'));
const Location = lazy(() => import('./inventory/invmaster/LocationPage'));
const Warehouse = lazy(() => import('./inventory/invmaster/WarehousePage'));
const CurrencyPage = lazy(() => import('./inventory/invmaster/CurrencyPage'));
const TaxComp = lazy(() => import('./inventory/invmaster/TaxComponent'));
const Taxgrp = lazy(() => import('./inventory/invmaster/Taxgroup'));
const Loca= lazy(() => import('./inventory/invmaster/Locator'));
const Despatch = lazy(() => import('./inventory/invmaster/DespatchMode'));
const InvReport = lazy(() => import('./inventory/InvReport'));
const InvOpenStock=lazy(() =>import('./inventory/invstockdetails/OpenStockUpdate'));
const InvStockLedger=lazy(()=>import('./inventory/invstockdetails/StockLedger'));
const Datalist = lazy(()=> import('./crm/Datalist'));
const Activity = lazy(()=> import('./crm/Activity'));


class AppRoutes extends Component {
  render () {
    return (
      <Suspense fallback={<Spinner/>}>
        <Switch>
          {/* Auth pages */}
          <Route exact path="/user-pages/login" component={Login} />
          <Route exact path="/user-pages/register" component={Register} />
          {/* Main App */}
          <Route exact path="/dashboard" component={Dashboard} />
          <Route path="/sales/salesmasters/CustomerPage" component={CustomerPage}/>
          <Route  path="/panelone/LeadForm" component={LeadForm}/>
          <Route path="/sales/salestransactions/order/Order" component={Order} />
         <Route path="/sales/salestransactions/order/OrderApproval" component={OrderApproval} />
          <Route path="/sales/salestransactions/quote/Quote" component={Quote}/>
          <Route path="/sales/salestransactions/quote/QuoteApproval" component={QuoteApproval}/>
          <Route path="/sales/salestransactions/invoice/Invoice" component={Invoice}/>
          <Route path="/sales/salestransactions/invoice/CustomerOrderBilling" component={CustomerOrderBilling}/>
          <Route path="/sales/salestransactions/invoice/BillingApproval" component={BillingApproval}/>
          <Route path="/sales/salestransactions/invoice/BillingAmendment" component={BillingAmendment}/>
          <Route path="/sales/salestransactions/invoice/BillingCancel" component={BillingCancel}/>
          <Route path="/sales/salestransactions/invoice/DirectBilling" component={DirectBilling}/>
          <Route path="/sales/salestransactions/servicecontract/servicecontractbilling" component={ContractBilling}/>
          <Route path="/sales/salestransactions/servicecontract/contractapproval" component={contractapproval}/>
          <Route path="/sales/salestransactions/invoice/cbill/contractfinalbill" component={ContractFinalBilling}/>
          <Route path="/sales/salestransactions/invoice/idbill/IndirectBilling" component={IndirectBilling}/>
          <Route path="/sales/salestransactions/invoice/tpbill/ThirdPartyBilling" component={ThirdPartyBilling}/>
          <Route path="/purchase/Supplier" component={Supplier}/>
          <Route path="/crm/Datalist" component={Datalist}/>
          <Route path="/crm/Activity" component={Activity}/>
          <Route path="/inventory/invmaster/ProductMaster" component={ProductMaster} />
          <Route path="/inventory/invmaster/UOMPage" component={UOMPage} />
          <Route path="/inventory/invmaster/PaymentTerms" component={Payment} />
          <Route path="/inventory/invmaster/LocationPage" component={Location} />
          <Route path="/inventory/invmaster/WarehousePage" component={Warehouse} />
          <Route path="/inventory/invmaster/Taxgroup" component={Taxgrp} />
          <Route path="/inventory/invmaster/CurrencyPage" component={CurrencyPage} />
          <Route path="/inventory/invmaster/Locator" component={Loca} />
          <Route path="/inventory/invmaster/TaxComponent" component={TaxComp} />
          <Route path="/inventory/invmaster/DespatchMode" component={Despatch} />
          <Route path="/inventory/invstockdetails/OpenStockUpdate" component={InvOpenStock} />
          <Route path="/inventory/invstockdetails/StockLedger" component={InvStockLedger}/>
          <Route path="/inventory/InvReport" component={InvReport}/>
          <Route path="/administrator" exact component={AdminMediaList} />
          <Route path="/administrator/OrganizationPage" component={OrganizationPage} />
          <Route path="/administrator/UserCreation" component={UserCreation} />
          {/* Default: go to Login first */}
          <Redirect to="/dashboard" />
        </Switch>
      </Suspense>
    );
  }
}

export default AppRoutes;