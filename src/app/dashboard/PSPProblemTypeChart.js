import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';

const COLORS = {
  S: '#3550c3', // Safety - red
  Q: '#4962c9', // Quality - blue
  D: '#5d73cf', // Delivery - yellow
  C: '#7285d5', // Cost - teal
  E: '#8696db'  // Environment - purple
};

export const PSPProblemTypeChart = ({ year }) => {
  const [dataRows, setDataRows] = useState([]);
  const fetchData = async () => {
    try {
      const res = await axios.get('/api/psp/problem-type-monthly', { params: { year: year || new Date().getFullYear() } });
      setDataRows(res.data || []);
    } catch (err) {
      console.error('Failed to fetch problem type monthly data', err);
      setDataRows([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  const months = dataRows.map(r => r.month);
  const sData = dataRows.map(r => Number(r.s) || 0);
  const qData = dataRows.map(r => Number(r.q) || 0);
  const dData = dataRows.map(r => Number(r.d) || 0);
  const cData = dataRows.map(r => Number(r.c) || 0);
  const eData = dataRows.map(r => Number(r.e) || 0);

  const data = {
    labels: months,
    datasets: [
      { label: 'Safety (S)', backgroundColor: COLORS.S, data: sData },
      { label: 'Quality (Q)', backgroundColor: COLORS.Q, data: qData },
      { label: 'Delivery (D)', backgroundColor: COLORS.D, data: dData },
      { label: 'Cost (C)', backgroundColor: COLORS.C, data: cData },
      { label: 'Environment (E)', backgroundColor: COLORS.E, data: eData }
    ]
  };

  const options = {
    responsive: true,
    legend: { position: 'top' },
    scales: {
      xAxes: [{ stacked: true }],
      yAxes: [{ stacked: true, ticks: { beginAtZero: true } }]
    },
    tooltips: {
      mode: 'index',
      intersect: false
    }
  };

  return (
    <div style={{ width: '95%', margin: 'auto' }}>
      <h3 style={{ textAlign: 'center' }}>Cards Raised per Month by Problem Type ({year || new Date().getFullYear()})</h3>
      <Bar data={data} options={options} />
    </div>
  );
};

export default PSPProblemTypeChart;
