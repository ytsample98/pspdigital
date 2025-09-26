import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword ,updateProfile} from "firebase/auth";
import { auth } from '../../firebase';

class Register extends Component {
  state = { email: "", password: "", username: "", error: "" };

   handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        this.state.email,
        this.state.password
      );

      // Optionally update profile with username
      await updateProfile(userCredential.user, {
        displayName: this.state.username
      });

      window.location.href = "/dashboard";

    } catch (err) {
      this.setState({ error: err.message });
    }
  };

  render() {
    return (
      <div>
        <div className="d-flex align-items-center auth px-0 min-vh-100 py-5">
          <div className="row w-100 mx-0">
            <div className="col-lg-4 mx-auto">
              <div className="auth-form-light text-left py-5 px-4 px-sm-5">
               
                <h4>New here?</h4>
                <h6 className="font-weight-light">Signing up is easy. It only takes a few steps</h6>

                {/* Same StarAdmin design, but real submit */}
                <form className="pt-3" onSubmit={this.handleSubmit}>
                  <div className="form-group">
                    <input type="text" className="form-control form-control-lg" placeholder="Username"
                      onChange={(e) => this.setState({ username: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <input type="email" className="form-control form-control-lg" placeholder="Email"
                      onChange={(e) => this.setState({ email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <input type="password" className="form-control form-control-lg" placeholder="Password"
                      onChange={(e) => this.setState({ password: e.target.value })}
                    />
                  </div>

                  {this.state.error && <p className="text-danger">{this.state.error}</p>}

                  <div className="mt-3">
                    {/* SAME BUTTON STYLE */}
                    <button type="submit" className="btn btn-block btn-primary btn-lg font-weight-medium auth-form-btn">
                      SIGN UP
                    </button>
                  </div>

                  <div className="text-center mt-4 font-weight-light">
                    Already have an account? <Link to="/user-pages/login" className="text-primary">Login</Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Register;
