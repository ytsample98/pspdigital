const db = require('../db') // Your PG connection pool/module

/**
 * Escalate PSC to new escalation level.
 * @param {Object} psc - PSC row object (must include id, escalation_id)
 * @param {Number} toEscalationId
 * @param {String} reason
 * @param {Number|null} triggeredBy - User ID or null
 * @returns {Promise}
 */
async function escalate(psc, toEscalationId, reason, triggeredBy = null) {
  // Start a transaction to ensure atomic update + insert
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Update PSC escalation_id
    await client.query(
      `UPDATE psccard SET escalation_id = $1 WHERE id = $2`,
      [toEscalationId, psc.id]
    );
    // Insert history
    await client.query(
      `INSERT INTO psccard_escalation_history 
      (psc_id, from_escalation_id, to_escalation_id, reason, triggered_by, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())`,
      [psc.id, psc.escalation_id, toEscalationId, reason, triggeredBy]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
module.exports = escalate;