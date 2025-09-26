import React, { Component } from "react";
import { db } from "../../../firebase";
import { collection, getDocs } from "firebase/firestore";
import "../../../assets/styles/components/_custom-table.scss";

class StockLedger extends Component {
  state = {
    ledgerRows: [],
    products: []
  };

  async componentDidMount() {
    // Fetch products for name lookup
    const prodSnap = await getDocs(collection(db, "products"));
    const products = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch opening stocks
    const openSnap = await getDocs(collection(db, "openStocks"));
    const openStocks = openSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch quotes (simulate sales)
    const quoteSnap = await getDocs(collection(db, "quotes"));
    const quotes = quoteSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Build transactions for each product
    let transactions = [];

    // Opening Stock transactions
    openStocks.forEach(os => {
      (os.lineItems || []).forEach(li => {
        transactions.push({
          date: os.date,
          productId: li.item, // item is productId or ptshortName
          type: "Opening Stock",
          qtyIn: parseFloat(li.qty) || 0,
          qtyOut: 0,
          reference: "Opening Balance"
        });
      });
    });

    // Quote transactions (simulate sales)
    quotes.forEach(q => {
      (q.lineItems || []).forEach(li => {
        transactions.push({
          date: q.quoteDate,
          productId: li.itemCode, // itemCode is productId
          type: "Sales Quote",
          qtyIn: 0,
          qtyOut: parseFloat(li.qty) || 0,
          reference: `Quote#${q.quoteNo || q.id}`
        });
      });
    });

    // Sort transactions by date ascending
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance for each product
    let balanceMap = {};
    let ledgerRows = [];
    transactions.forEach(tx => {
      const prod = products.find(p => p.productId === tx.productId || p.ptshortName === tx.productId) || {};
      const key = tx.productId;
      if (!balanceMap[key]) balanceMap[key] = 0;
      balanceMap[key] += tx.qtyIn - tx.qtyOut;
      ledgerRows.push({
        date: tx.date,
        productId: tx.productId,
        productName: prod.ptshortName || prod.productId || tx.productId,
        transactionType: tx.type,
        qtyIn: tx.qtyIn,
        qtyOut: tx.qtyOut,
        balance: balanceMap[key],
        reference: tx.reference
      });
    });

    this.setState({ ledgerRows, products });
  }

  render() {
    const { ledgerRows } = this.state;
    return (
      <div className="card full-height">
        <div className="card-body">
          <h4 className="card-title">Stock Ledger</h4>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead className="thead-light">
                <tr>
                  <th>Date</th>
                  <th>Product ID</th>
                  <th>Product Name</th>
                  <th>Transaction</th>
                  <th>Qty In</th>
                  <th>Qty Out</th>
                  <th>Balance</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.date}</td>
                    <td>{row.productId}</td>
                    <td>{row.productName}</td>
                    <td>{row.transactionType}</td>
                    <td style={{ color: "green" }}>{row.qtyIn}</td>
                    <td style={{ color: "red" }}>{row.qtyOut}</td>
                    <td>{row.balance}</td>
                    <td>{row.reference || "-"}</td>
                  </tr>
                ))}
                {ledgerRows.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

export default StockLedger;