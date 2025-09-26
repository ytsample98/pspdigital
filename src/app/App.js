import React, { Component, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import Navbar from './shared/NavBar';
import Sidebar from './shared/Sidebar'
import AppRoutes from './AppRoutes';
import './App.scss';
import { auth } from '../firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth';

const Login = lazy(() => import('./user-pages/Login'));
const Register = lazy(() => import('./user-pages/Register'));

class App extends Component {
  state = { user: null, loading: true };

  componentDidMount() {
   onAuthStateChanged(auth, (user) => {
  if (user) {
    // ✅ Only redirect to dashboard if you're at login/register
    if (window.location.pathname.startsWith("/user-pages")) {
      window.location.href = "/dashboard";
    }
  } else {
    // ✅ Force login if not authenticated
    if (!window.location.pathname.startsWith("/user-pages")) {
      window.location.href = "/user-pages/login";
    }
  }
  this.setState({ user, loading: false });
});

  }
  handleLogout = async () => {
  await signOut(auth);
  localStorage.clear(); // clear cached businessGroup etc.
  window.location.href = "/user-pages/login";
}

  render() {
    if (this.state.loading) {
      return <div className="text-center mt-5">Loading...</div>;
    }

    return (
      <Router>
        <div className="container-scroller">
          {/* If no user, only show login/register */}
          {!this.state.user ? (
            <Suspense fallback={<div>Loading...</div>}>
              <Switch>
                <Route exact path="/user-pages/login" component={Login} />
                <Route exact path="/user-pages/register" component={Register} />
                <Redirect to="/user-pages/login" />
              </Switch>
            </Suspense>
          ) : (
            // If logged in → show full app (with sidebar + navbar + routes)
            <>
              <Navbar onLogout={this.handleLogout} />
              <div className="container-fluid page-body-wrapper">
                <Sidebar />
                <div className="main-panel">
                  <div className="content-wrapper">
                    <AppRoutes />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Router>
    );
  }
}

export default App;
