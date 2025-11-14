import React, { useEffect, useState } from 'react';
import '../../assets/styles/PSPCompetencyTable.css';
import toast, { Toaster,ToastContainer } from 'react-hot-toast';
import PSPChart from './PSPChart';

/*export default function PSPCompetencyTable() {
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
      if (!res.ok) throw new Error(Server returned ${res.status});
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
        throw new Error(body.error || Server returned ${res.status});
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
      return ${row.year}-${String(row.month).padStart(2, '0')};
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
          <div className="last-refreshed">{lastRefreshedAt ? Last: ${new Date(lastRefreshedAt).toLocaleString()} : ''}</div>
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
                      <td className={competency-cell ${compClass}}>
                        {pct === null ? '-' : ${pct}%}
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
}*/


export default function PSPCompetencyTable() {

const [data, setData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const simulateTrigger = (type, problemNo) => {
    if (type === 'card_created') {
      toast.success(`🆕 Card Created! Problem #${problemNo}`, {
        position: 'top-right',
        autoClose: 3000,
      });
    } else if (type === 'card_completed') {
      toast.info(`✅ Card Completed! Problem #${problemNo}`, {
        position: 'top-right',
        autoClose: 3000,
      });
    } else {
      toast.warning(`⚠️ Unknown trigger: ${type}`);
    }
  };

 const fetchData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const res = await fetch('/api/psp/yearly-report');
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

  const getCompetencyClass = (value) => {
    if (value < 50) return "low";        // red
    if (value <= 70) return "medium";    // yellow
    return "high";                       // green
  };
  const dashdata = [
    { month: "Jan", raised: 85, closed: 31, competency: 93 },
{ month: "Feb", raised: 8, closed: 5, competency: 100 },
{ month: "Mar", raised: 18, closed: 4, competency: 89 },
{ month: "Apr", raised: 21, closed: 10, competency: 95 },
{ month: "May", raised: 9, closed: 3, competency: 89 },
{ month: "Jun", raised: 14, closed: 6, competency: 77 },
{ month: "Jul", raised: 23, closed: 13, competency: 70 },
{ month: "Aug", raised: 13, closed: 8, competency: 75 },
{ month: "Sep", raised: 18, closed: 8, competency: 61 },
{ month: "Oct", raised: 21, closed: 8, competency: 78 },
  ];

  return (
    <div className="psp-dashboard">

      <h2 className="title">PSP Competency</h2>
      <div className="competency-legend">
        <div className="legend-item legend-red">
          &lt; 60%
        </div>

        <div className="legend-item legend-yellow">
          60% – 80%
        </div>

        <div className="legend-item legend-green">
          &gt; 80%
        </div>
      </div>
      <div className="table-container">

        <table className="competency-table">
          <thead>
            {/*<tr className="summary-row">
              <th colSpan="6" className="summary-title">PSP Card Competency</th>
              <th>YTD Raised</th>
              <th>231</th>
              <th>YTD Closure</th>
              <th>181</th>
              <th>YTD Closure (%)</th>
              <th>78%</th>
            </tr>
            */}
            <tr>
              <th rowSpan="2">Months</th>
              <th colSpan="3">Team Leader</th>
              <th colSpan="3">Value Stream Leader</th>
              <th colSpan="3">Plant Level</th>
              <th rowSpan="2">Pending</th>
              <th rowSpan="2">PSP</th>
            </tr>
            <tr>
              <th>Card Raised</th>
              <th>Cards Closed</th>
              <th>Opened Cards</th>

              <th>Cards Escalated</th>
              <th>Card Closed</th>
              <th>Cards Opened</th>

              <th>Cards Escalated</th>
              <th>Card Closed</th>
              <th>Cards Opened</th>
            </tr>
          </thead>

          <tbody>
           {data.length === 0 ? (
                <tr><td colSpan="7" className="text-center">No data</td></tr>
              ) : (data.map((row, idx) => {
                  const pct = (row.closure_percent !== null && row.closure_percent !== undefined)
                    ? Number(row.closure_percent)
                    : null;
                  const compClass = getCompetencyClass(pct);
                  return (
              <tr key={idx}>
                <td>{row.month}</td>

                {/* Team Leader */}
                <td>{row.teamLeader.raised}</td>
                <td>{row.teamLeader.tl_closed}</td>
                <td>{row.teamLeader.tl_opened}</td>

                {/* Value Stream Leader */}
                <td>{row.valueStreamLeader.vsl_escalated}</td>
                <td>{row.valueStreamLeader.vsl_closed}</td>
                <td>{row.valueStreamLeader.vsl_opened}</td>

                {/* Plant Level */}
                <td>{row.plantLevel.plant_escalated}</td>
                <td>{row.plantLevel.plant_closed}</td>
                <td>{row.plantLevel.plant_opened}</td>

                <td>{row.pending}</td>
                {/* <td className={getCompetencyClass(row.competency)}>
                  {row.competency}%
                </td> */}
                 <td className={row.raised === 0 || row.competency == null ? "" : getCompetencyClass(row.competency)}>
                    {row.raised === 0 || row.competency == null ? "#Div/0!" : `${row.competency}%`}
                  </td>
              </tr>
            );
 })
)}
          </tbody>
        </table>
        
      </div>
      {/* <div className="chart-container">
        <PSPChart dashdata={dashdata} />  
      </div> */}
    </div>
    
  );
}
