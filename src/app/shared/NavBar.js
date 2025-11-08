import React, { Component } from 'react';
import { Dropdown } from 'react-bootstrap';
import { FaBell } from "react-icons/fa6";
import { FaSignOutAlt} from "react-icons/fa"
import { Modal, Button } from 'react-bootstrap';


class Navbar extends Component {
  //state = { user: null };
  state = {
    user: null,
    notifications: [],
    showNotifications: false,
    showProfile: false,
  };

   
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
    window.addEventListener("psc-notification", (e) => {
  this.addNotification(e.detail);
});

  }

  

  componentWillUnmount() {
    if (this._onStorage) window.removeEventListener('storage', this._onStorage);
     window.removeEventListener("psc-notification", this.addNotification);
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
// addNotification = (message) => {
//     this.setState((prev) => ({
//       notifications: [...prev.notifications, { id: Date.now(), message }],
//     }));
//   };
addNotification = (cardId, message) => {
    this.setState((prev) => ({
      // notifications: [...prev.notifications, { id: Date.now(), message }],
      notifications: [...prev.notifications, { id: Date.now(), cardId, message }],
    }));
  };

  toggleNotifications = () => {
    this.setState((prev) => ({
      showNotifications: !prev.showNotifications,
      // remove count when opened
      notifications: prev.showNotifications ? prev.notifications : [],
    }));
  };
 

  render() {
    //const { user } = this.state;
    const { user, notifications, showNotifications } = this.state;
    const notificationCount = notifications.length;
    const userName =
      (user && (user.username || user.name || user.displayName || user.usermail || user.email)) ||
      'User';
    const initial = userName ? userName.charAt(0).toUpperCase() : 'U';
    const sendNotification = (message) => {
  window.dispatchEvent(new CustomEvent("psc-notification", { detail: message }));
};


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

 <div className="d-none d-md-flex align-items-center" style={{ marginLeft: 16 }}>
  <img
    src={require("../../assets/images/Mahle.jpg")}
    alt="Custom"
    style={{ maxHeight: 35 }}
  />
  <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 16, color: '#333' }}>
    Shop Floor Management (PSP)
  </span>
</div>



          {/* Search */}
          

          {/* Right section */}
          <ul className="navbar-nav navbar-nav-right">
 {/* Notification Icon */}
<li
  className="nav-item position-relative mx-3"
  style={{ cursor: "pointer" }}
>
  {/* Bell icon */}
  <FaBell size={22} color="#333" onClick={() => this.setState({ showNotifications: true ,notificationCount:true})} />

  {/* Count badge */}
  {notificationCount > 0 && (
    <span
      style={{
        position: "absolute",
        top: "-4px",
        right: "-4px",
        backgroundColor: "red",
        color: "white",
        borderRadius: "50%",
        width: "18px",
        height: "18px",
        fontSize: "11px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
    {notificationCount}
    </span>
  )}

  {/* Notification Dropdown */}
  {showNotifications && (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: "30px",
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "6px",
        width: "240px",
        zIndex: 1000,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      {/* Header with close (X) button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid #eee",
          fontWeight: "bold",
          fontSize: "14px",
        }}
      >
        Notifications
        <span
          style={{
            cursor: "pointer",
            color: "#888",
            fontSize: "18px",
            lineHeight: "14px",
          }}
          onClick={() =>
            this.setState({ showNotifications: false, notificationCount: 0 })
          }
        >
          ×
        </span>
      </div>

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div
          style={{
            padding: "10px",
            fontSize: "13px",
            color: "#555",
            textAlign: "center",
          }}
        >
          No new notifications
        </div>
      ) : (
        this.state.notifications.map((n) => (
          <div
            key={n.id}
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #eee",
              fontSize: "13px",
            }}
          >
            {n.message}
          </div>
        ))
      )}
    </div>
  )}
</li>
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
  <li className="nav-item nav-profile border-0 d-flex align-items-center">
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
        cursor: "pointer"
      }}
      onClick={() => this.setState({ showProfile: true })}
    >
      {initial}
    </div>
    <div style={{ marginLeft: 8, fontWeight: 600, color: "#222" }}>
      {userName}
    </div>
    <FaSignOutAlt
      size={20}
      color="#333"
      style={{ marginLeft: 12, cursor: "pointer" }}
      onClick={this.handleLogout}
      title="Sign Out"
    />
  </li>
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
        
<Modal show={this.state.showProfile} onHide={() => this.setState({ showProfile: false })} centered>
  <Modal.Header closeButton>
    <Modal.Title>Profile</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    {user && (
      <>
        <div className="form-group mb-3">
          <label>Emp Code</label>
          <input type="text" className="form-control" value={user.empcode || ''} readOnly />
        </div>
        <div className="form-group mb-3">
          <label>User Name</label>
          <input type="text" className="form-control" value={user.username || ''} readOnly />
        </div>
        <div className="form-group mb-3">
          <label>Department</label>
          <input type="text" className="form-control" value={user.department || ''} readOnly />
        </div>
        <div className="form-group mb-3">
          <label>Mail</label>
          <input type="text" className="form-control" value={user.email || ''} readOnly />
        </div>
      </>
    )}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => this.setState({ showProfile: false })}>
      Close
    </Button>
  </Modal.Footer>
</Modal>
      </nav>
      
    );
    
  }
  
}

export default Navbar;
