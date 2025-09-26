// PartyTables.js
import React, { Component } from 'react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';

class PartyTables extends Component {
  state = {
    customers: [],
    orgs: [],
    vendors: [],
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    const collections = ['customers', 'orgs', 'vendors'];
    for (const type of collections) {
      const snapshot = await getDocs(collection(db, type));
      const data = snapshot.docs.map((doc, i) => ({ id: doc.id, index: i + 1, ...doc.data() }));
      this.setState({ [type]: data });
    }
  };

  renderTable = (data, type) => (
    <div className="card mt-4">
      <div className="card-body">
        <h4 className="card-title">{type.charAt(0).toUpperCase() + type.slice(1)} List</h4>
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>ID</th>
                <th>Company</th>
                <th>Name</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={item.id}>
                  <td>{type[0]}{index + 1}</td>
                  <td>{item.company}</td>
                  <td>{item.name}</td>
                  <td>{item.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  render() {
    return (
      <div className="container-fluid">
        {this.renderTable(this.state.customers, 'customers')}
        {this.renderTable(this.state.orgs, 'orgs')}
        {this.renderTable(this.state.vendors, 'vendors')}
      </div>
    );
  }
}

export default PartyTables;
