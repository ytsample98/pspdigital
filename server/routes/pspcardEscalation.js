// API to change escalation on a psccard and record history
// POST /api/psp/psccard/:id/escalate
// body: { to_escalation_id: number, changed_by: userId (optional) }
// This route performs a transaction: update psccard.escalation_id and insert into psccard_escalation_history.

const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/psccard/:id/escalate', async (req, res) => {
  console.log('Received escalation request for psccard id:', req.params.id);
  const pscId = parseInt(req.params.id, 10);
  const { to_escalation_id, changed_by } = req.body || {};

  if (!pscId || typeof to_escalation_id === 'undefined' || to_escalation_id === null) {
    return res.status(400).json({ error: 'psccard id and to_escalation_id are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the psccard row to avoid race conditions
    const cur = await client.query('SELECT escalation_id FROM psccard WHERE id = $1 FOR UPDATE', [pscId]);
    if (cur.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'psccard not found' });
    }
    const fromEsc = cur.rows[0].escalation_id;

    // Update the psccard escalation_id (this also fires the DB trigger that inserts history)
    await client.query(
      `UPDATE psccard SET escalation_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [to_escalation_id, pscId]
    );

    // Additionally insert history row with changed_by if provided. The DB trigger will already insert
    // a history row with changed_by=NULL. If the caller provides changed_by we insert a second row
    // that records the actor (this is optional; if you don't want duplicate rows simply omit this insert).
    if (changed_by) {
      await client.query(
        `INSERT INTO psccard_escalation_history (psccard_id, from_escalation_id, to_escalation_id, changed_by, changed_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [pscId, fromEsc, to_escalation_id, changed_by]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, message: 'Escalation updated (history recorded)' });
    console.log(`escalation updated for psccard ${pscId}: ${fromEsc} -> ${to_escalation_id}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error escalating psccard', err);
    res.status(500).json({ error: 'Failed to escalate psccard', details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;