import React, { Component } from 'react';
import { Dropdown } from 'react-bootstrap';

class Navbar extends Component {
  state = { user: null };
  componentDidMount() {
    // Read authenticated user from localStorage (set by Login.js)
    try {
      const json = localStorage.getItem('dcmsUser');
      const user = json ? JSON.parse(json) : null;
      this.setState({ user });
    } catch (e) {
      this.setState({ user: null });
    }

    // Update when other tabs change auth
    this._onStorage = (e) => {
      if (e.key === 'dcmsUser') {
        try {
          const user = e.newValue ? JSON.parse(e.newValue) : null;
          this.setState({ user });
        } catch (err) {
          this.setState({ user: null });
        }
      }
    };
    window.addEventListener('storage', this._onStorage);
  }

  componentWillUnmount() {
    if (this._onStorage) window.removeEventListener('storage', this._onStorage);
  }

  handleLogout = async () => {
    // Clear only app-related keys so we don't remove unrelated storage
    localStorage.removeItem('dcmsUser');
    // keep businessGroup if you want; if not, uncomment next line
    // localStorage.removeItem('businessGroup');
    window.location.href = '/user-pages/login';
  };

  toggleOffcanvas() {
    document.querySelector('.sidebar-offcanvas').classList.toggle('active');
  }
  toggleRightSidebar() {
    document.querySelector('.right-sidebar').classList.toggle('open');
  }

  render() {
    const { user } = this.state;
    const userName =
      (user && (user.username || user.name || user.displayName || user.usermail || user.email)) ||
      'User';
    const initial = userName ? userName.charAt(0).toUpperCase() : 'U';

    return (
      <nav className="navbar col-lg-12 col-12 p-lg-0 fixed-top d-flex flex-row">
        <div className="navbar-menu-wrapper d-flex align-items-center justify-content-between">
          <a
            className="navbar-brand brand-logo-mini align-self-center d-lg-none"
            href="!#"
            onClick={(evt) => evt.preventDefault()}
          >
            <img
              src={require("../../assets/images/logo-mini.svg")}
              alt="logo"
            />
          </a>
          <button
            className="navbar-toggler navbar-toggler align-self-center"
            type="button"
            onClick={() =>
              document.body.classList.toggle("sidebar-icon-only")
            }
          >
            <i className="mdi mdi-menu"></i>
          </button>

          
<div className="d-none d-md-block" style={{ marginLeft: 16 }}>
      <img
        src={require("../../assets/images/Mahle.jpg")}
        alt="Custom"
        style={{ maxHeight: 35 }}
      />
    </div>


          {/* Search */}
          

          {/* Right section */}
          <ul className="navbar-nav navbar-nav-right">

            {/* Company Name */}
            <li className="nav-item nav-profile border-0 d-flex align-items-center">
              <span style={{ fontWeight: 600, fontSize: 18, color: "#222" }}>
                {localStorage.getItem("businessGroup")
                  ? JSON.parse(localStorage.getItem("businessGroup")).bgName
                  : ""}
              </span>
            </li>

            {/* User Profile Dropdown or Sign In link */}
            {user ? (
              <Dropdown align="end" className="nav-item nav-profile border-0">
                <Dropdown.Toggle
                  variant="light"
                  id="dropdown-user"
                  className="d-flex align-items-center border-0 bg-transparent"
                >
                  {/* Circle avatar with initial */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: '#007bff',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {initial}
                  </div>
                  <div style={{ marginLeft: 8, fontWeight: 600, color: '#222' }}>
                    {userName}
                  </div>
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item onClick={this.handleLogout}>Sign Out</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <li className="nav-item nav-profile border-0 d-flex align-items-center">
                <a href="/user-pages/login" className="btn btn-outline-primary btn-sm">
                  Sign In
                </a>
              </li>
            )}
          </ul>

          {/* Mobile menu button */}
          <button
            className="navbar-toggler navbar-toggler-right d-lg-none align-self-center"
            type="button"
            onClick={this.toggleOffcanvas}
          >
            <span className="mdi mdi-menu"></span>
          </button>
        </div>
      </nav>
    );
  }
}

export default Navbar;
