import React, { Component,Suspense, lazy } from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';

import Spinner from '../app/shared/Spinner';
import OrganizationPage from './administrator/OrganizationPage';

const Dashboard = lazy(() => import('./dashboard/Dashboard'));
const Register= lazy(() => import('./user-pages/Register'));
const Login = lazy(() => import('./user-pages/Login'));

const pspform=lazy(()=> import('./psp/pspform'));
const OrgPage=lazy(()=> import('./administrator/OrganizationPage'));
const UserCreation=lazy(()=> import('./administrator/UserCreation'));
const AdminMediaList=lazy(()=> import('./administrator/AdminPage'));
const Masters=lazy(()=> import('./administrator/Masters'));
const PSC=lazy(()=>import('./PSCList'));
const CA= lazy(()=>import('./CorrectiveAction'));
const RCA=lazy(()=>import('./RootCause'));
const EffectCheck=lazy(()=>import('./EffectCheck'));


class AppRoutes extends Component {
  render () {
    return (
      <Suspense fallback={<Spinner/>}>
        <Switch>
          {/* Auth pages */}
          <Route exact path="/user-pages/login" component={Login} />
          {/* Main App */}
          <Route exact path="/dashboard" component={Dashboard} />
          <Route path="/psp/pspform" component={pspform} />
          <Route path='/PSCList' component={PSC}/>
          <Route path='/CorrectiveAction' component={CA}/>
          <Route path='/RootCause' component={RCA}/>
          <Route path='/EffectCheck' component={EffectCheck}/>
          <Route path="/administrator" exact component={AdminMediaList} />
          <Route path="/administrator/OrganizationPage" component={OrganizationPage} />
          <Route path="/administrator/UserCreation" component={UserCreation} />
          <Route path="/administrator/Masters" component={Masters} />
          {/* Default: go to Login first */}
          <Redirect to="/dashboard" />
        </Switch>
      </Suspense>
    );
  }
}

export default AppRoutes;