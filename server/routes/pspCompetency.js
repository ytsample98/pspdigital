const express = require('express');
const router = express.Router();

const pool = require('../db');
router.get('/competency-report', async (req, res) => {
  console.log('Fetching competency report');
  try {
    const q = `
      SELECT year, month, to_char(month_start, 'YYYY-MM-DD') as month_start,
             cards_raised, cards_closed, cards_opened, cards_escalated, pending, closure_percent
      FROM psp_competency_monthly
      ORDER BY year, month;
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
    console.log('Competency report fetched, rows:', rows.length);
  } catch (err) {
    console.error('Error fetching competency report', err);
    res.status(500).json({ error: 'Failed to fetch competency report' });
  }
});

// POST /api/psp/competency-report/refresh
// Triggers recalculation for given range (optional start_date, end_date in body)
router.post('/competency-report/refresh', async (req, res) => {
  const { start_date, end_date } = req.body || {};
  try {
    const params = [];
    let call = 'SELECT refresh_psp_competency_monthly(';
    if (start_date) {
      call += '$1::date';
      params.push(start_date);
      if (end_date) {
        call += ', $2::date';
        params.push(end_date);
      }
    } else if (end_date) {
      call += 'NULL, $1::date';
      params.push(end_date);
    } else {
      call += 'NULL, NULL';
    }
    call += ');';
    await pool.query(call, params);
    res.json({ ok: true, message: 'Refresh completed' });
  } catch (err) {
    console.error('Error refreshing competency report', err);
    res.status(500).json({ error: 'Failed to refresh competency report' });
  }
});

module.exports = router;
