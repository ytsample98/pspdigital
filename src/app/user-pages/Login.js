import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import axios from 'axios';
import { Link } from 'react-router-dom';

class Login extends Component {
  state = { email: "", password: "", error: "" };

  handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/login', { usermail: this.state.email, password: this.state.password });
      // store minimal user in localStorage
      localStorage.setItem('dcmsUser', JSON.stringify(res.data));
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err && err.response && err.response.data && err.response.data.error ? err.response.data.error : (err.message || 'Login failed');
      this.setState({ error: msg });
    }
  };

  render() {
    return (
      <div className="d-flex align-items-center auth px-0 min-vh-100 py-5">
        <div className="row w-100 mx-0">
          <div className="col-lg-4 mx-auto">
            <div className="auth-form-light text-left py-5 px-4 px-sm-5">
             
              <h4>Hello! let's get started</h4>
              <h6 className="font-weight-light">Sign in to continue.</h6>
              <Form className="pt-3" onSubmit={this.handleSubmit}>
                <Form.Group>
                  <Form.Control
                    type="email"
                    placeholder="Email"
                    size="lg"
                    onChange={(e) => this.setState({ email: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Control
                    type="password"
                    placeholder="Password"
                    size="lg"
                    onChange={(e) => this.setState({ password: e.target.value })}
                    required
                  />
                </Form.Group>

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
      </div>
    );
  }
}

export default Login;
