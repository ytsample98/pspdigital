import React, { useEffect, useState } from 'react';
import '../../assets/styles/YTDMetricCards.css';
import PSPCompetencyTable from './PSPCompetencyTable';

const YTDMetricCards = () => {
  const [metrics, setMetrics] = useState({
    cardsOpened: 85,
    cardsClosed: 195,
    closurePercent: ''
  });

  useEffect(() => {
    // Fetch PSP data from backend API
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/psp/ytd-metrics'); // Adjust endpoint
        const data = await response.json();

        const opened = data.cardsOpened || 0;
        const closed = data.cardsClosed || 0;
        const closurePercent = opened > 0 ? ((closed / opened) * 100).toFixed(1) : 0;

        setMetrics({
          cardsOpened: opened,
          cardsClosed: closed,
          closurePercent
        });
      } catch (error) {
        console.error('Error fetching YTD metrics:', error);
      }
    };

    fetchMetrics();
  }, []);

  return (
  <div className="dashboard-wrapper">

    {/* Metric Cards */}
    <div className="ytd-metric-container">
      <div className="metric-card">
        <h2 className="metric-value">{metrics.cardsOpened}</h2>
        <p className="metric-label">YTD Cards Opened</p>
      </div>
      <div className="metric-card">
        <h2 className="metric-value">{metrics.cardsClosed}</h2>
        <p className="metric-label">YTD Cards Closed</p>
      </div>
      <div className="metric-card">
        <h2 className="metric-value">{metrics.closurePercent}%</h2>
        <p className="metric-label">YTD Closure %</p>
      </div>
    </div>

    {/* Report Below */}
    <div className="report-section">
      <PSPCompetencyTable />
    </div>

  </div>
);

};

export default YTDMetricCards;