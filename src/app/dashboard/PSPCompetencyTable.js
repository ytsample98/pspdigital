import React, { useEffect, useState } from 'react';

export default function PSPCompetencyTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/psp/competency-report'); // No role param now
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message || 'Failed to load');
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <h4>PSP Competency Report</h4>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Cards Raised</th>
              <th>Cards Closed</th>
              <th>Cards Opened</th>
              <th>Cards Escalated</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan="6">No data</td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.month}</td>
                  <td>{row.role}</td>
                  <td>{row.cards_raised || '-'}</td>
                  <td>{row.cards_closed || '-'}</td>
                  <td>{row.cards_opened || '-'}</td>
                  <td>{row.cards_escalated || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}