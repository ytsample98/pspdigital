const express = require('express');
const router = express.Router();
const db = require('../db');
const escalate = require('../utils/escalate');

function getEscalationJoinSQL(tableAlias = 'p') {
  return `
    LEFT JOIN escalation e ON ${tableAlias}.escalation_id = e.id
  `;
}

/**
 * Returns joined PSC row, auto-escalating if needed.
 */
router.get('/:id', async (req, res) => {
  const pscId = req.params.id;
  try {
    // Fetch PSC (including escalation info)
    const { rows } = await db.query(
      `SELECT p.*, 
              e.level AS escalation_level,
              e.name AS escalation_name,
              e.authority_id
       FROM psccard p
       ${getEscalationJoinSQL('p')}
       WHERE p.id = $1`,
      [pscId]
    );
    if (!rows.length) return res.status(404).json({ error: 'PSC not found' });

    let psc = rows[0];
    let updated = false;

    // Auto-escalation logic
    if (psc.status !== 'Completed') {
      const now = new Date();
      if (
        psc.escalation_level === 'L1' &&
        !psc.cause &&
        psc.created_at &&
        (now - new Date(psc.created_at)) / (1000 * 60 * 60) > 24
      ) {
        // Escalate to L2
        const L2 = await db.query(`SELECT id FROM escalation WHERE level = 'L2'`);
        if (L2.rows.length) {
          await escalate(psc, L2.rows[0].id, 'Auto-escalated: TL inactive >24hr');
          updated = true;
        }
      } else if (
        psc.escalation_level === 'L2' &&
        (psc.vsl_unresolved && (now - new Date(psc.l2_escalated_at)) / (1000 * 60 * 60) > 48 ||
        psc.is_long_term === true)
      ) {
        // Escalate to L3
        const L3 = await db.query(`SELECT id FROM escalation WHERE level = 'L3'`);
        if (L3.rows.length) {
          await escalate(psc, L3.rows[0].id, 'Auto-escalated: VSL unresolved >48h or Long-term CM');
          updated = true;
        }
      }
    }

    // If escalated, re-query PSC row
    if (updated) {
      const { rows: freshRows } = await db.query(
        `SELECT p.*, 
          e.level AS escalation_level,
          e.name AS escalation_name,
          e.authority_id
         FROM psccard p
         ${getEscalationJoinSQL('p')}
         WHERE p.id = $1`,
        [pscId]
      );
      psc = freshRows[0];
    }

    res.json(psc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// (Optionally: repeat similar logic for /api/psc bulk fetches)
module.exports = router;