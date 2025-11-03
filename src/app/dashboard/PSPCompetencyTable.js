import React, { useEffect, useState } from 'react';
import '../../assets/styles/PSPCompetencyTable.css';

export default function PSPCompetencyTable() {
  const [data, setData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  // fetch the monthly summary rows
  const fetchData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const res = await fetch('/api/psp/competency-report');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      setData(json || []);
    } catch (err) {
      setError(err.message || 'Failed to load');
      setData([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // call refresh endpoint which runs the DB refresh function and then re-fetch rows
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      // call refresh - backend route accepts optional start_date & end_date if needed
      const res = await fetch('/api/psp/competency-report/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // no dates - full refresh
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }
      // wait a short moment to give DB function time to finish in case it runs async on server
      // (the route we use waits for the function to finish, but keep slight delay to improve UX)
      await new Promise(r => setTimeout(r, 300));
      await fetchData();
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      setError(err.message || 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const friendlyMonth = (row) => {
    if (row.month_start) {
      const d = new Date(row.month_start);
      return d.toLocaleString(undefined, { year: 'numeric', month: 'short' }); // e.g. "Jan 2025"
    }
    if (row.year && row.month) {
      return `${row.year}-${String(row.month).padStart(2, '0')}`;
    }
    return '';
  };

  const getCompetencyClass = (pct) => {
    if (pct === null || pct === undefined) return 'competency-na';
    if (pct < 60) return 'competency-low';
    if (pct < 80) return 'competency-medium';
    return 'competency-high';
  };

  return (
    <div className="psp-competency-wrapper card p-3">
      <div className="psp-competency-header d-flex align-items-center justify-content-between">
        <div>
          <h3 className="title-line">PSP Competency <span className="title-sub">Dashboard</span></h3>
          <div className="subtitle">PSP Card Competency (monthly)</div>
        </div>

        <div className="actions">
          <button
            className="btn btn-primary btn-sm refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing || loadingData}
            aria-busy={refreshing}
          >
            {refreshing ? <span className="btn-spinner" /> : 'Refresh'}
          </button>
          <div className="last-refreshed">{lastRefreshedAt ? `Last: ${new Date(lastRefreshedAt).toLocaleString()}` : ''}</div>
        </div>
      </div>

      {loadingData ? (
        <div className="loading-area">
          <div className="large-spinner" role="status" aria-label="Loading data" />
          <div>Loading data...</div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <div className="table-responsive">
          <table className="psp-table table table-sm table-bordered">
            <thead>
              <tr className="header-top">
                <th rowSpan="2" className="month-col">Months</th>

                <th colSpan="1">Cards Raised</th>
                <th colSpan="1">Cards Closed</th>
                <th colSpan="1">Opened Cards</th>
                <th colSpan="1">Cards Escalated</th>
                <th colSpan="1">Pending</th>
                <th rowSpan="2" className="competency-col">PSP Competency</th>
              </tr>
              <tr className="header-sub">
                <th className="small-col">#</th>
                <th className="small-col">#</th>
                <th className="small-col">#</th>
                <th className="small-col">#</th>
                <th className="small-col">#</th>
              </tr>
            </thead>

            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan="7" className="text-center">No data</td></tr>
              ) : (
                data.map((row, idx) => {
                  const pct = (row.closure_percent !== null && row.closure_percent !== undefined)
                    ? Number(row.closure_percent)
                    : null;
                  const compClass = getCompetencyClass(pct);
                  return (
                    <tr key={idx}>
                      <td className="month-col">{friendlyMonth(row)}</td>
                      <td className="num-col">{row.cards_raised ?? 0}</td>
                      <td className="num-col">{row.cards_closed ?? 0}</td>
                      <td className="num-col">{row.cards_opened ?? 0}</td>
                      <td className="num-col">{row.cards_escalated ?? 0}</td>
                      <td className="num-col">{row.pending ?? 0}</td>
                      <td className={`competency-cell ${compClass}`}>
                        {pct === null ? '-' : `${pct}%`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {refreshing && (
        <div className="refresh-overlay" aria-hidden={!refreshing}>
          <div className="overlay-card">
            <div className="large-spinner" />
            <div className="overlay-text">Recalculating metrics — please wait...</div>
          </div>
        </div>
      )}
    </div>
  );
}