import React, { Component } from 'react';
import { Dropdown } from 'react-bootstrap';
import { auth } from '../../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

class Navbar extends Component {
  state = { user: null };

  componentDidMount() {
    // Listen for user
    this.unsubscribe = onAuthStateChanged(auth, (user) => {
      this.setState({ user });
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  handleLogout = async () => {
    await signOut(auth);
    localStorage.clear(); // clear cached data like businessGroup
    window.location.href = "/user-pages/login"; // force back to login
  };

  toggleOffcanvas() {
    document.querySelector('.sidebar-offcanvas').classList.toggle('active');
  }
  toggleRightSidebar() {
    document.querySelector('.right-sidebar').classList.toggle('open');
  }

  render() {
    const { user } = this.state;
    const userName = user?.displayName || user?.email || "User";
    const initial = userName.charAt(0).toUpperCase();

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

          {/* Search */}
          <form className="ml-auto search-form d-none d-md-block" action="#">
            <div className="form-group">
              <input
                type="search"
                className="form-control"
                placeholder="Search Here"
              />
            </div>
          </form>

          {/* Right section */}
          <ul className="navbar-nav navbar-nav-right">

            {/* Company Name */}
            <li className="nav-item nav-profile border-0 d-flex align-items-center">
              <span style={{ fontWeight: 600, fontSize: 18, color: "#222" }}>
                {localStorage.getItem("businessGroup")
                  ? JSON.parse(localStorage.getItem("businessGroup")).bgName
                  : "Company Name"}
              </span>
            </li>

            {/* User Profile Dropdown */}
            {user && (
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
                      borderRadius: "50%",
                      backgroundColor: "#007bff",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {initial}
                  </div>
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item onClick={this.handleLogout}>
                    Sign Out
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
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
