import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../../assets/styles/Login.css';
import { FaUser, FaKey
,FaLock,FaEye, FaEyeSlash } from "react-icons/fa";

/*
  UI-only changes:
  - background & logo kept as images in src/assets/images/
  - form layout changed visually (glassmorphism + blur + stylish font)
  - no changes to login logic (axios call, localStorage, redirect are untouched)
*/

class Login extends Component {
  // state = { email: "", password: "", error: "" };
   state = { email: "", password: "", error: "",showPassword: false,
 };

  handleSubmit = async (e) => {
    console.log('Submitting login form');
    e.preventDefault();
    try {
      const res = await axios.post('/api/login', { usermail: this.state.email, password: this.state.password });
      // store minimal user in localStorage
      console.log('login success', res.data.password);
      localStorage.setItem('dcmsUser', JSON.stringify(res.data));
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err && err.response && err.response.data && err.response.data.error ? err.response.data.error : (err.message || 'Login failed');
      this.setState({ error: msg });
    }
  };

  render() {
   return (
  <div className="login-page">
    <div className="login-overlay">
      <div className="left-panel">
        {/* <div className="brand-area">
          <div className="brand-copy">
            <h1>Shop Floor Management - Problem Solving Process</h1>
          </div>
        </div> */}
      </div>

      <div className="right-panel">
        <div className="brand-area">
          <div className="brand-copy">
            <h1>
  <span>Shop Floor Management - </span><br/>
  <span>Problem Solving Process</span>
</h1>

          </div>
        </div>
        <div className="signup-card glass-card">
          <div className="card-header text-center">
            {/* 👇 MAHLE logo inside signup box */}
            <img
              src={require('../../assets/images/Mahlelogo.jpg')}
              alt="MAHLE"
              className="mahle-logo"
              style={{
                width: '100px',
                marginBottom: '10px',
              }}
            />
            <p className="mt-2">PSP Digital</p>
          </div>

          <Form className="pt-2" onSubmit={this.handleSubmit}>
            <div style={{ position: "relative" }}>
          <FaUser
            style={{
              position: "absolute",
              top: "50%",
              left: "10px",
              transform: "translateY(-50%)",
              color: "#608ed8ff",
            }}
          />

            <Form.Group>
              
              <Form.Control
style={{paddingLeft: "35px"}}

                type="email"
                placeholder="Email"
                size="lg"
                onChange={(e) => this.setState({ email: e.target.value })}
                required
              />
            </Form.Group>
            </div>
            <div style={{ position: "relative" }}>
          <FaKey
            style={{
              position: "absolute",
              top: "50%",
              left: "10px",
              transform: "translateY(-50%)",
              color: "#608ed8ff",
            }}
          />
          {/* Right Eye Icon */}
  <span
    onClick={() =>
      this.setState({ showPassword: !this.state.showPassword })
    }
    style={{
      position: "absolute",
      top: "50%",
      right: "12px",
      transform: "translateY(-50%)",
      cursor: "pointer",
      color: "#888",
      fontSize: "20px",
      zIndex: 2,
    }}
  >
    {this.state.showPassword ? <FaEyeSlash /> : <FaEye />}
  </span>
            <Form.Group>
              <Form.Control
                // type="password"
                style={{paddingLeft: "35px"}}
                type={this.state.showPassword ? "text" : "password"}
                placeholder="Password"
                size="lg"
                onChange={(e) => this.setState({ password: e.target.value })}
                required
              />
            </Form.Group>
            </div>

            {this.state.error && <p className="text-danger">{this.state.error}</p>}

            <div className="mt-3">
              <button
                type="submit"
                className="btn btn-block btn-primary btn-lg font-weight-medium auth-form-btn"
              >
                SIGN IN
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>

    {/* 👇 Footer with Powered by Yaanar */}
    <footer
      style={{
        textAlign: 'center',
        color: 'white',
        marginTop: '20px',
        fontSize: '14px',
      }}
    >
      Powered by Yaanar Technologies Pvt Ltd.
    </footer>
  </div>
);

  }
}

export default Login;