import React, { Component, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import Navbar from './shared/NavBar';
import Sidebar from './shared/Sidebar'
import AppRoutes from './AppRoutes';
import './App.scss';
// We no longer use Firebase auth here; rely on server login that stores `dcmsUser` in localStorage

const Login = lazy(() => import('./user-pages/Login'));
const Register = lazy(() => import('./user-pages/Register'));

class App extends Component {
  state = { user: null, loading: true };

  componentDidMount() {
    // Read logged-in user from localStorage (set by Login.js after successful server login)
    try {
      const raw = localStorage.getItem('dcmsUser');
      const user = raw ? JSON.parse(raw) : null;
      // If not on auth pages and no user → force login
      if (!user && !window.location.pathname.startsWith('/user-pages')) {
        window.location.href = '/user-pages/login';
    }
      // If user exists and currently on auth pages → go to dashboard
      if (user && window.location.pathname.startsWith('/user-pages')) {
        window.location.href = '/dashboard';
  }
  this.setState({ user, loading: false });
    } catch (e) {
      this.setState({ user: null, loading: false });
    }

  }
  handleLogout = async () => {
    // clear stored user and other cached items; then redirect to login
    localStorage.removeItem('dcmsUser');
    localStorage.removeItem('businessGroup');
    window.location.href = '/user-pages/login';
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
