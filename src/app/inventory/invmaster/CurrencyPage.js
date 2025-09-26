import React, { Component } from 'react';
import Papa from 'papaparse';
import { db } from '../../../firebase';import { collection, addDoc, getDocs } from 'firebase/firestore';

class CurrencyPage extends Component {
  state = {
    currencies: [],
    file: null
  };

  handleFileChange = (e) => {
    this.setState({ file: e.target.files[0] });
  };

  handleUpload = () => {
    if (!this.state.file) return alert('Upload a CSV file first');

    Papa.parse(this.state.file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const currencies = result.data.map(row => ({
          code: row['Currency'], name: row['Name'] // Change these to your actual column names
        }));

        for (const cur of currencies) {
          await addDoc(collection(db, 'currencies'), cur);
        }

        this.setState({ currencies });
        alert('Currencies saved to Firestore!');
      }
    });
  };

  componentDidMount = async () => {
    const snap = await getDocs(collection(db, 'currencies'));
    const currencies = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setState({ currencies });
  };

  render() {
    return (
      <div className="container mt-3">
        <h4>Currency Master</h4>
        <input type="file" accept=".csv" onChange={this.handleFileChange} className="form-control-file mb-2" />
        <button onClick={this.handleUpload} className="btn btn-primary btn-sm">Upload CSV</button>
        <div className="mt-3">
          <table className="table table-sm table-bordered">
            <thead><tr><th>Currency</th><th>Name</th></tr></thead>
            <tbody>
              {this.state.currencies.map((c, idx) => (
                <tr key={idx}><td>{c.code}</td><td>{c.name}</td></tr>
              ))}
              {this.state.currencies.length === 0 && <tr><td colSpan="2">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default CurrencyPage;
