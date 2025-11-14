// server/index.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
require("./scheduler");
app.use(cors());
app.use(express.json());

// Allowed columns per table (used to whitelist fields from frontend)
const TABLE_COLUMNS = {
  notifications: ['name', 'trigger', 'responsibility', 'link', 'message'],
  organization: ['short_name', 'business_group_name', 'effective_from', 'effective_to', 'financial_year', 'status', 'address_line1', 'address_line2', 'address_line3', 'area', 'country', 'state', 'city', 'zipcode', 'landline', 'mobile', 'fax', 'website', 'email', 'twitter', 'company_reg_no', 'place_of_old_reg', 'tax_reg_no', 'currency', 'logo_url'],
  department: ['dept_code', 'dept_name', 'created_by', 'created_date'],
  valuestream: ['vl_code', 'vl_name', 'created_by', 'created_date'],
  position: ['position_code', 'position_name', 'created_by', 'created_date'],
  line: ['line_code', 'line_name', 'vl_code', 'created_by', 'created_date'],
  machine: ['machine_name', 'machine_no', 'machine_type', 'created_by', 'created_date'],
  shift: ['shift_name', 'shift_type', 'start_time', 'end_time', 'created_by', 'created_date'],
  plant: ['plant_name', 'plant_type', 'created_by', 'created_date'],
  users: ['plant_id', 'emp_code', 'username', 'email', 'password', 'dept_id', 'user_type_id', 'user_resp_id', 'created_by', 'created_date']
};

// normalize users columns to match current DB (empcode, usermail, lock_user)
TABLE_COLUMNS['users'] = ['plant_id', 'empcode', 'username', 'usermail', 'password', 'dept_id', 'user_type_id', 'user_resp_id', 'lock_user', 'created_by', 'created_date'];

// add user masters
TABLE_COLUMNS['user_type'] = ['type_name'];
TABLE_COLUMNS['user_responsibility'] = ['resp_name', 'pages'];
TABLE_COLUMNS['escalation'] = ['escalation_id', 'escalation_name', 'time_duration', 'authority_id'];

// --- Test route to check DB connection ---
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`✅ PostgreSQL Connected Successfully. Current Time: ${result.rows[0].now}`);
  } catch (err) {
    console.error('❌ Database test failed:', err.message);
    res.status(500).send('❌ Database connection failed: ' + err.message);
  }
});

// --- Get organization (only one record expected) ---
app.get('/api/organization', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM organization LIMIT 1');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /api/organization error:', err.message);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// --- Create organization (only if none exists) ---
app.post('/api/organization', async (req, res) => {
  try {
    const orgs = await pool.query('SELECT id FROM organization');
    if (orgs.rows.length > 0)
      return res.status(400).json({ error: 'Organization already exists' });

    // Whitelist allowed columns to avoid SQL errors if frontend sends unexpected fields
    const allowed = new Set([
      'short_name', 'business_group_name', 'effective_from', 'effective_to', 'financial_year', 'status',
      'address_line1', 'address_line2', 'address_line3', 'area', 'country', 'state', 'city', 'zipcode',
      'landline', 'mobile', 'fax', 'website', 'email', 'twitter',
      'company_reg_no', 'place_of_old_reg', 'tax_reg_no', 'currency', 'logo_url'
    ]);

    const fields = Object.keys(req.body).filter(k => allowed.has(k));
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

    const values = fields.map(f => req.body[f]);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(',');

    const result = await pool.query(
      `INSERT INTO organization (${fields.join(',')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ POST /api/organization error:', err);
    res.status(500).send('Insert failed: ' + (err.message || String(err)));
  }
});

// --- Update organization ---
app.put('/api/organization/:id', async (req, res) => {
  try {
    // Whitelist allowed columns for update as well
    const allowed = new Set([
      'short_name', 'business_group_name', 'effective_from', 'effective_to', 'financial_year', 'status',
      'address_line1', 'address_line2', 'address_line3', 'area', 'country', 'state', 'city', 'zipcode',
      'landline', 'mobile', 'fax', 'website', 'email', 'twitter',
      'company_reg_no', 'place_of_old_reg', 'tax_reg_no', 'currency', 'logo_url'
    ]);

    const fields = Object.keys(req.body).filter(k => allowed.has(k));
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields provided for update' });

    const values = fields.map(f => req.body[f]);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE organization SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ PUT /api/organization error:', err);
    res.status(500).send('Update failed: ' + (err.message || String(err)));
  }
});

// --- Server startup with DB check ---
const PORT = process.env.SERVER_PORT || 5000;

(async () => {
  try {
    // Test database connection before starting server
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Database connected successfully at: ${result.rows[0].now}`);

    // Try starting Express server
    const server = app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );

    // Handle startup errors (e.g., port in use)
    server.on('error', (err) => {
      console.error('❌ Server startup error:', err.message);
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err);
    process.exit(1);
  }
})();

module.exports = app;

// --- Generic master endpoints ---
const createMasterEndpoints = (name) => {
  // list
  app.get(`/api/${name}`, async (req, res) => {
    try {
      const q = `SELECT * FROM ${name} ORDER BY id DESC`;
      const result = await pool.query(q);
      res.json(result.rows);
    } catch (err) {
      console.error(`❌ GET /api/${name} error:`, err && err.stack || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // create
  app.post(`/api/${name}`, async (req, res) => {
    try {
      const allowed = TABLE_COLUMNS[name] || [];
      const keys = Object.keys(req.body).filter(k => allowed.includes(k));
      if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
      const values = keys.map(k => req.body[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const q = `INSERT INTO ${name} (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`;
      const result = await pool.query(q, values);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(`❌ POST /api/${name} error:`, err && err.stack || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });
  // update
  app.put(`/api/${name}/:id`, async (req, res) => {
    try {
      const allowed = TABLE_COLUMNS[name] || [];
      const keys = Object.keys(req.body).filter(k => allowed.includes(k));
      if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
      const values = keys.map(k => req.body[k]);
      const setClause = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
      values.push(req.params.id);
      const q = `UPDATE ${name} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
      const result = await pool.query(q, values);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(`❌ PUT /api/${name}/:id error:`, err && err.stack || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });
};

['department', 'position', 'line', 'machine', 'shift', 'plant', 'valuestream', 'user_type', 'user_responsibility', 'escalation', 'notifications'].forEach(createMasterEndpoints);
async function getEffectivenessMap(countermeasureIds) {
  const effRes = await pool.query(
    `SELECT * FROM effectiveness_check WHERE countermeasure_id = ANY($1::int[]) ORDER BY checked_at ASC`, [countermeasureIds]
  );
  // Map: { [countermeasure_id]: [checks...] }
  const effMap = {};
  for (const row of effRes.rows) {
    if (!effMap[row.countermeasure_id]) effMap[row.countermeasure_id] = [];
    effMap[row.countermeasure_id].push(row);
  }
  return effMap;
}
const mapFullPscRow = async (pscRow) => {
  if (!pscRow) return null;
  const id = pscRow.id;
  // Get corrective action and department
  const correctiveQ = `SELECT c.*, d.dept_name FROM corrective c LEFT JOIN department d ON c.corrective_assign_to = d.id WHERE c.psc_id = $1`;
  const correctiveRes = await pool.query(correctiveQ, [id]);
  const corrective = correctiveRes.rows[0] || null;

  // Get root cause (note new final_cause column)
  const rootCauseQ = `SELECT * FROM root_cause WHERE psccard_id = $1`;
  const rootCauseRes = await pool.query(rootCauseQ, [id]);
  const rootCause = rootCauseRes.rows[0] || null;

  // Get countermeasures (new column names: description, target_date, type, cm_status)
  let countermeasures = [];
  if (rootCause) {
    const cmQ = `SELECT id, root_cause_id, assigned_to, assigned_remarks, description, target_date, type, created_by, cm_status, created_at, updated_at,comments FROM countermeasure WHERE root_cause_id = $1 ORDER BY id ASC`;
    const cmRes = await pool.query(cmQ, [rootCause.id]);
    // Map row fields to frontend-friendly names
    countermeasures = cmRes.rows.map(r => ({
      id: r.id,
      rootCauseId: r.root_cause_id,
      assignedTo: r.assigned_to,
      assignedRemarks: r.assigned_remarks,
      // new canonical name is `description` (keep `countermeasure` as alias for compatibility)
      description: r.description,
      countermeasure: r.description,
      targetDate: r.target_date ? r.target_date.toISOString().split('T')[0] : null,
      type: r.type,
      createdBy: r.created_by,
      cm_status: r.cm_status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      comments:r.comments
    }));
  }

   let effMap = {};
  if (rootCause) {
    const cmQ = `SELECT * FROM countermeasure WHERE root_cause_id = $1 ORDER BY id ASC`;
    const cmRes = await pool.query(cmQ, [rootCause.id]);
    const cmList = cmRes.rows;
    // Fetch all effectiveness checks for these CMs
    const cmIds = cmList.map(r => r.id);
    effMap = cmIds.length ? await getEffectivenessMap(cmIds) : {};
    countermeasures = cmList.map(r => ({
      ...r,
      effectChecks: effMap[r.id] || [],
      lastEffectCheck: (effMap[r.id] || []).slice(-1)[0] || null
      // You may want to flatten further in frontend
    }));
  }

  // Compose output
  return {
    ...pscRow,
    problemNumber: pscRow.problem_number,
    initiatorName: pscRow.initiator_name,
    valueStreamLine: pscRow.value_stream_line,
    lineCode: pscRow.line_code,
    shortDescription: pscRow.short_description,
    problemtype: pscRow.problem_type,
    problemDescription: pscRow.problem_description,
    qtyAffected: pscRow.qty_affected,
    partAffected: pscRow.part_affected,
    ticketStage: pscRow.ticket_stage || pscRow.ticketStage,
    correctiveAction: corrective,
    root_cause: rootCause ? {
      ...rootCause,
      final_cause: rootCause.final_cause,
      countermeasures // attach array of CMs
    } : null,
    effMap,

  };

};

app.get('/api/psc', async (req, res) => {
  try {
    // const { status } = req.query;
    const { userRespId } = req.query;
    // let q = 'SELECT * FROM psccard';
    // const params = [];
    console.log("Fetch PSC card details userRespId :", userRespId)
    let escalationTable = ''; 
    let condition='';
    if (userRespId == 2) {
      escalationTable = 'escalation_level1';
      condition=' AND es1.user_rep_level = 0';
    } else if (userRespId == 3) {
      escalationTable = 'escalation_level2';
    } else if (userRespId == 4) {
      escalationTable = 'escalation_level3';
    } else {
      escalationTable = 'escalation_level1';
      condition=  ' AND es1.user_rep_level = 0';
    }

    let q = `
  SELECT ps.* 
  FROM psccard AS ps
  LEFT JOIN ${escalationTable} AS es1 
    ON es1.psccard_id = ps.id
  WHERE es1.user_resp_id = $1  AND es1.user_rep_level = 0
`;
    const params = [userRespId];
    //  if (userRespId == 2) {
    //   q += condition;
    //  }

    // if (status) {
    //   q += ' WHERE status = $2';
    //   params.push(status);
    // }
    // q += ' ORDER BY id DESC';
    const result = await pool.query(q, params);
    // Join all PSCs
    const joinedRows = await Promise.all(result.rows.map(mapFullPscRow));
    res.json(joinedRows);
  } catch (err) {
    console.error('❌ GET /api/psc error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/api/psc/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM psccard WHERE id = $1', [req.params.id]);
    const r = result.rows[0];
    if (!r) return res.json(null);
    const joined = await mapFullPscRow(r);
    res.json(joined);
  } catch (err) {
    console.error('❌ GET /api/psc/:id error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});
app.get('/api/psc', async (req, res) => {
  const result = await pool.query('SELECT id, problem_number, status FROM psccard');
  res.json(result.rows);
});

app.post('/api/psc', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert PSP card
    const allowed = [
      'problem_number', 'initiator_name', 'date', 'shift', 'value_stream_line',
      'line_id', 'short_description', 'problem_description', 'qty_affected', 'problem_type',
      'part_affected', 'supplier', 'status', 'ticket_stage', 'created_by'
    ];
    const keys = Object.keys(req.body).filter(k => allowed.includes(k));
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const insertCardQuery = `INSERT INTO psccard (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`;
    const cardResult = await client.query(insertCardQuery, values);
    const psc = cardResult.rows[0];

    // 2. Fetch escalation master for Level 1
    const escMaster = await client.query(`SELECT id, time_duration FROM escalation WHERE escalation_id = 'L1' LIMIT 1`);
    const escData = escMaster.rows[0];
    const escalationId = escData.id;
    const timeDuration = escData.time_duration;
    const userQuery = await client.query(`SELECT user_resp_id FROM users WHERE username = $1`, [psc.initiator_name]);
    const userRespId = userQuery.rows[0]?.user_resp_id;

    // 3. Calculate due_time
    const dueTimeQuery = `SELECT (CURRENT_TIMESTAMP + INTERVAL '${timeDuration} HOURS') AS due_time`;
    const dueTimeResult = await client.query(dueTimeQuery);
    const dueTime = dueTimeResult.rows[0].due_time;

    // 4. Insert Level 1 escalation record
    const insertEscQuery = `
      INSERT INTO escalation_level1 (psccard_id, escalation_id, user_resp_id, status, due_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`;
    const escValues = [psc.id, escalationId, userRespId, psc.status, dueTime];
    const escResult = await client.query(insertEscQuery, escValues);
    const escRecord = escResult.rows[0];

    await client.query('COMMIT');

    // 5. Return PSP card + escalation info
    res.json({ psccard: psc, escalation_level1: escRecord });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ POST /api/psc error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
app.get("/api/psccard/maxcount", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT MAX(CAST(SUBSTRING(problem_number FROM 4) AS INTEGER)) AS max_num
      FROM psccard
    `);
    const maxNum = rows[0].max_num || 0;
   
    res.json({ maxNum });
  } catch (err) {
    console.error("Error generating next PSC:", err);
    res.status(500).json({ nextPSC: "PSC001" });
  }
});
// generic PSC update (partial)
app.put('/api/psc/:id', async (req, res) => {
  try {
    // whitelist allowed psc columns
    const allowed = ['problem_number', 'initiator_name', 'date', 'shift', 'value_stream_line', 'problem_type', 'line_code', 'short_description', 'problem_description', 'qty_affected', 'part_affected', 'supplier', 'status', 'ticket_stage', 'corrective_action', 'root_cause', 'corrective_action_by', 'root_cause_by', 'corrective_action_date', 'root_cause_date', 'effectiveness_checked', 'effectiveness_remarks', 'effectiveness_date'];
    const keys = Object.keys(req.body).filter(k => allowed.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const values = keys.map(k => req.body[k]);
    const setClause = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
    values.push(req.params.id);
    const q = `UPDATE psc SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await pool.query(q, values);
    res.json(await mapFullPscRow(result.rows[0]));
  } catch (err) {
    console.error('❌ PUT /api/psc/:id error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// corrective action update
app.put('/api/psc/:id/corrective', async (req, res) => {
  try {
    const { action_taken, done_by, corrective_assign_to, corrective_comments, userRespId } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update or insert corrective action
      const correctiveResult = await client.query(
        `INSERT INTO corrective 
        (psc_id, action_taken, done_by, corrective_assign_to, corrective_comments)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (psc_id) 
        DO UPDATE SET 
          action_taken = $2, done_by = $3, 
          corrective_assign_to = $4, corrective_comments = $5,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [req.params.id, action_taken, done_by, corrective_assign_to, corrective_comments]
      );

      // Update PSC status
      await client.query(
        `UPDATE psccard SET status = $1, ticket_stage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        ['Work in Progress', 'Do', req.params.id]
      );
      console.log("corrective save userRespId :", userRespId);
      console.log("corrective save userRespId :", req.params.id,req.params.psc_id);
      if (userRespId == 2) {
        await client.query(
          `UPDATE escalation_level1 SET status = $1 WHERE psccard_id = $2`,
          ['Work in Progress', req.params.id]
        );
      }
      if (userRespId == 3) {
        await client.query(
          `UPDATE escalation_level2 SET status = $1 WHERE psccard_id = $2`,
          ['Work in Progress', req.params.id]
        );
      }
      if (userRespId == 4) {
        await client.query(
          `UPDATE escalation_level3 SET status = $1 WHERE psccard_id = $2`,
          ['Work in Progress', req.params.id]
        );
      }

      await client.query('COMMIT');
      // Return joined PSC data
      const pscRes = await pool.query('SELECT * FROM psccard WHERE id = $1', [req.params.id]);
      const joined = await mapFullPscRow(pscRes.rows[0]);
      res.json(joined);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ PUT /api/psc/:id/corrective error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// root cause update
app.put('/api/psc/:id/rootcause', async (req, res) => {
  try {
    const { why1, why2, why3, why4, why5, final_cause, filled_by, countermeasures,userRespId } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Upsert root_cause row
      const rcResult = await client.query(
        `INSERT INTO root_cause 
        (psccard_id, why1, why2, why3, why4, why5, final_cause, filled_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (psccard_id) 
        DO UPDATE SET 
          why1 = $2, why2 = $3, why3 = $4, why4 = $5, why5 = $6,
          final_cause = $7,
          filled_by = $8, updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [req.params.id, why1, why2, why3, why4, why5, final_cause, filled_by]
      );

      const rootCauseRow = rcResult.rows[0];

      // If countermeasures provided, replace existing countermeasures for this root_cause
      if (Array.isArray(countermeasures)) {
        // delete existing CM rows for this root cause (simple replacement)
        await client.query('DELETE FROM countermeasure WHERE root_cause_id = $1', [rootCauseRow.id]);

        // insert new ones
        for (let i = 0; i < countermeasures.length; i++) {
          const cm = countermeasures[i] || {};
          // Map incoming payloads (frontend may send description or countermeasure for backwards compat)
          const vals = [
            rootCauseRow.id,
            cm.assignTo || cm.assignedTo || cm.assigned_to || null,
            cm.assignedRemarks || cm.assigned_remarks || null,
            cm.description || cm.countermeasure || null,
            cm.targetDate || cm.target_date || null,
            cm.type || null,
            cm.created_by || cm.createdBy || null,
            cm.cm_status || cm.status || 'Pending',
            new Date(),
            new Date()
          ];
          const placeholders = vals.map((_, idx) => `$${idx + 1}`).join(',');
          const q = `INSERT INTO countermeasure (
            root_cause_id,
            assigned_to,
            assigned_remarks,
            description,
            target_date,
            type,
            created_by,
            cm_status,
            created_at,
            updated_at
          ) VALUES (${placeholders})`;
          await client.query(q, vals);
        }
      }

      // // Update PSC status and stage
      // await client.query(
      //   `UPDATE psccard SET status = $1, ticket_stage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      //   ['For Validation', 'Check', req.params.id]
      // );
      // console.log('rootcause',req.params.id)

      // console.log("corrective save userRespId :", userRespId);
      // if (userRespId == 2) {
      //   await client.query(
      //     `UPDATE escalation_level1 SET status = $1 WHERE psccard_id = $2`,
      //     ['For Validation', req.params.id]
      //   );
      // }
      // if (userRespId == 3) {
      //   await client.query(
      //     `UPDATE escalation_level2 SET status = $1 WHERE psccard_id = $2`,
      //     ['For Validation', req.params.id]
      //   );
      // }
      // if (userRespId == 4) {
      //   await client.query(
      //     `UPDATE escalation_level3 SET status = $1 WHERE psccard_id = $2`,
      //     ['For Validation', req.params.id]
      //   );
      // }

      await client.query('COMMIT');
      // Return joined PSC data
      const pscRes = await pool.query('SELECT * FROM psccard WHERE id = $1', [req.params.id]);
      const joined = await mapFullPscRow(pscRes.rows[0]);
      res.json(joined);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ PUT /api/psc/:id/rootcause error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/psc/:id/countermeasure', async (req, res) => {
  try {
    const { description, targetDate, type, created_by,comments ,userRespId} = req.body;
    // Find root_cause for this psc
    const rcRes = await pool.query('SELECT * FROM root_cause WHERE psccard_id = $1 LIMIT 1', [req.params.id]);
    const rootCause = rcRes.rows[0];
    if (!rootCause) return res.status(400).json({ error: 'Root cause not found for this PSC. Save root cause first.' });

  //   const insertQ = `INSERT INTO countermeasure (root_cause_id, psccard_id, description, target_date, type, created_by, cm_status, created_at, updated_at)
  // VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7, $8) RETURNING *`;
  //   const now = new Date();
  //   const cmRes = await pool.query(insertQ,
  //     [rootCause.id, req.params.id, description, targetDate || null, type || null, created_by || null, now, now]);

  //   const cm = cmRes.rows[0];


  const existingRes = await pool.query(
      'SELECT * FROM countermeasure WHERE root_cause_id = $1 AND psccard_id = $2 LIMIT 1',
      [rootCause.id, req.params.id]
    );
    let cm;
    const now = new Date();
    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      const updatedComments = existing.comments
        ? `${existing.comments}, ${comments}`
        : comments;

      // If new comments were provided, move CM to 'For Validation'
      const newStatus = (comments && comments.toString().trim()) ? 'For Validation' : (existing.cm_status || 'Pending');

      const updateRes = await pool.query(
        `UPDATE countermeasure
         SET comments = $1,
             cm_status = $2,
             updated_at = $3
         WHERE id = $4
         RETURNING *`,
        [updatedComments, newStatus, now, existing.id]
      );

      cm = updateRes.rows[0];
          await pool.query(
        `UPDATE psccard SET status = $1, ticket_stage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        ['For Validation', 'Check', req.params.id]
      );
      console.log('rootcause',req.params.id)

      console.log("corrective save userRespId :", userRespId);
      if (userRespId == 2) {
        await pool.query(
          `UPDATE escalation_level1 SET status = $1 WHERE psccard_id = $2`,
          ['For Validation', req.params.id]
        );
      }
      if (userRespId == 3) {
        await pool.query(
          `UPDATE escalation_level2 SET status = $1 WHERE psccard_id = $2`,
          ['For Validation', req.params.id]
        );
      }
      if (userRespId == 4) {
        await pool.query(
          `UPDATE escalation_level3 SET status = $1 WHERE psccard_id = $2`,
          ['For Validation', req.params.id]
        );
      }

    } else {


      // 3b. Insert new countermeasure
      // If initial comments are provided at create time, set status to 'For Validation', otherwise 'Pending'
      const initialStatus = (comments && comments.toString().trim()) ? 'For Validation' : 'Pending';

      const insertRes = await pool.query(
        `INSERT INTO countermeasure
          (root_cause_id, psccard_id, description, target_date, type, created_by, cm_status, created_at, updated_at, comments)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [rootCause.id, req.params.id, description, targetDate || null, type || null, created_by || null, initialStatus, now, now, comments]
      );

      cm = insertRes.rows[0];
          await pool.query(
        `UPDATE psccard SET status = $1, ticket_stage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        ['Work in Progress', 'Check', req.params.id]
      );
      console.log('rootcause',req.params.id)

      console.log("corrective save userRespId :", userRespId);
      if (userRespId == 2) {
        await pool.query(
          `UPDATE escalation_level1 SET status = $1 WHERE psccard_id = $2`,
          ['Work in Progress', req.params.id]
        );
      }
      if (userRespId == 3) {
        await pool.query(
          `UPDATE escalation_level2 SET status = $1 WHERE psccard_id = $2`,
          ['Work in Progress', req.params.id]
        );
      }
      if (userRespId == 4) {
        await pool.query(
          `UPDATE escalation_level3 SET status = $1 WHERE psccard_id = $2`,
          ['Work in Progress', req.params.id]
        );
      }


      
    }

  //   // 1. Insert countermeasure_log entry for creation event
  //   await pool.query(
  //     `INSERT INTO countermeasure_log (countermeasure_id, log_type, log_text, logged_by, created_at)
  //  VALUES ($1, 'User Comment', $2, $3, $4)`,
  //     [cm.id, `Countermeasure created: ${description || ''}`, created_by || null, now]
  //   );

  //   // 2. Set the PSC status to "Work in Progress"
  //   await pool.query(
  //     `UPDATE psccard SET status = 'Work in Progress', ticket_stage = 'Do', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
  //     [req.params.id]
  //   );

    // Return the PSC (updated) so frontend can refresh easily
    const pscRes = await pool.query('SELECT * FROM psccard WHERE id = $1', [req.params.id]);
    // Reuse your existing mapFullPscRow function in file — assume available
    // If mapFullPscRow is defined later, this code may need to be moved; adjust accordingly.
    if (typeof mapFullPscRow === 'function') {
      const joined = await mapFullPscRow(pscRes.rows[0]);
      // return res.json(joined);
    }
    // res.json({ success: true });

    const effcm = await pool.query(`SELECT 
        c.*,
         STRING_AGG(e.remarks, ', ') AS reasons
       FROM countermeasure c
       LEFT JOIN effectiveness_check e ON e.countermeasure_id = c.id
       WHERE c.id = $1
       GROUP BY c.id` ,[cm.id]);

      console.log(effcm,'lll',cm.id,pscRes)

      return res.json(effcm.rows)
      
    



  } catch (err) {
    console.error('❌ POST /api/psc/:id/countermeasure error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});
app.get('/api/psc/:id/countremark', async (req, res) => {
  try {
    const pscId = req.params.id;
    

    const result = await pool.query(`
    SELECT 
        c.*,
         STRING_AGG(e.remarks, ', ') AS reasons
       FROM countermeasure c
       LEFT JOIN effectiveness_check e ON e.countermeasure_id = c.id
       WHERE c.psccard_id = $1
       GROUP BY c.id;
    `, [pscId]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Fetch countermeasure history (chronological) from countermeasure_log
app.get('/api/countermeasure/:cmId/history', async (req, res) => {
  try {
    const cmId = req.params.cmId;
    const q = `SELECT cl.*, u.username AS logged_by_name
               FROM countermeasure_log cl
               LEFT JOIN users u ON cl.logged_by = u.id
               WHERE cl.countermeasure_id = $1
               ORDER BY cl.created_at ASC`;
    const result = await pool.query(q, [cmId]);
    const rows = result.rows.map(r => ({
      id: r.id,
      countermeasure_id: r.countermeasure_id,
      type: r.log_type,
      text: r.log_text,
      logged_by: r.logged_by,
      logged_by_name: r.logged_by_name,
      timestamp: r.created_at
    }));
    res.json(rows);
  } catch (err) {
    console.error('❌ GET /api/countermeasure/:cmId/history error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Post a user comment on a countermeasure:
// - Inserts a countermeasure_log entry with log_type = 'User Comment'
// - If CM's current cm_status is 'Pending', update it to 'For Validation'
app.post('/api/countermeasure/:cmId/comment', async (req, res) => {
  try {
    const cmId = req.params.cmId;
    const { comment, logged_by } = req.body;
    if (!comment || !comment.toString().trim()) return res.status(400).json({ error: 'Comment text required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const now = new Date();
      await client.query(
        `INSERT INTO countermeasure_log (countermeasure_id, log_type, log_text, logged_by, created_at)
         VALUES ($1, 'User Comment', $2, $3, $4)`,
        [cmId, comment, logged_by || null, now]
      );

      const cmCurrent = await client.query('SELECT cm_status, psccard_id FROM countermeasure WHERE id = $1 FOR UPDATE', [cmId]);
      if (cmCurrent.rows.length === 0) { /* ... */ }
      const cmStatus = cmCurrent.rows[0].cm_status || 'Pending';
      const psccardId = cmCurrent.rows[0].psccard_id;

      if (cmStatus === 'Pending') {
        await client.query(
          `UPDATE countermeasure SET cm_status = 'For Validation', updated_at = $2 WHERE id = $1`,
          [cmId, now]
        );
        // Also update PSC status
        await client.query(
          `UPDATE psccard SET status = 'For Validation', ticket_stage = 'Check', updated_at = $2 WHERE id = $1`,
          [psccardId, now]
        );
      }

      await client.query('COMMIT');

      // Return refreshed history for convenience
      const hist = await pool.query(
        `SELECT cl.*, u.username AS logged_by_name
               FROM countermeasure_log cl
               LEFT JOIN users u ON cl.logged_by = u.id
               WHERE cl.countermeasure_id = $1
               ORDER BY cl.created_at ASC`,
        [cmId]
      );
      res.json({ success: true, history: hist.rows });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ POST /api/countermeasure/:cmId/comment error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/api/psc/:id/effectcheck', async (req, res) => {
  try {
    const pscId = req.params.id;
    // Get all effectiveness_check rows for this PSC, filtered by "Rejected"
    const q = `
      SELECT countermeasure_id, remarks, check_status
      FROM effectiveness_check
      WHERE psccard_id = $1
    `;
    const result = await pool.query(q, [pscId]);
    res.json(result.rows); 
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/api/psc/:id/effectcheck', async (req, res) => {
  try {
    const pscId = req.params.id;

    const result = await pool.query(`
     SELECT 
           e.*,
           c.id AS countermeasure_id,
           STRING_AGG(e.remarks, ', ') AS reasons
         FROM psccard p
         LEFT JOIN countermeasure c ON c.psccard_id = p.id
         LEFT JOIN effectiveness_check e ON e.countermeasure_id = c.id
         WHERE p.id = $1
         GROUP BY p.id, c.id;
    `, [pscId]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.put('/api/psc/:id/effectcheck', async (req, res) => {
  try {
    console.log('working')
    const { countermeasure_id, check_status, checked_by, remarks,userRespId } = req.body;
    if (!countermeasure_id) return res.status(400).json({ error: 'countermeasure_id is required' });
    if (!check_status) return res.status(400).json({ error: 'check_status is required' });
    console.log(remarks)

    const client = await pool.connect();
    try {

      await client.query('BEGIN');

      // 1) Verify that the countermeasure belongs to the PSC requested (security)
      const cmQ = `
        SELECT c.id AS cm_id, c.root_cause_id, r.psccard_id
        FROM countermeasure c
        JOIN root_cause r ON c.root_cause_id = r.id
        WHERE c.id = $1
        FOR UPDATE
      `;
      const cmRes = await client.query(cmQ, [countermeasure_id]);
      if (cmRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Countermeasure not found' });
      }
      const cmRow = cmRes.rows[0];
      if (String(cmRow.psccard_id) !== String(req.params.id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Countermeasure does not belong to the specified PSC' });
      }
      // Before executing your main INSERT
      const problemNumber = req.body.problem_number;
      const exists = await pool.query("SELECT 1 FROM psccard WHERE problem_number = $1", [problemNumber]);
      if (exists.rows.length) {
        return res.status(400).json({ error: 'Problem number already exists' });
      }


      // 2) Insert or update effectiveness_check keyed by countermeasure_id
      // NOTE: schema: effectiveness_check(countermeasure_id, checked_by, check_status, remarks, checked_at)
      // Do not attempt to set `updated_at` here since the table does not have that column.
      // 2) Insert or update effectiveness_check keyed by countermeasure_id

      await client.query(
        `INSERT INTO effectiveness_check
    (countermeasure_id,psccard_id, checked_by, check_status, remarks, checked_at)
   VALUES ($1, $2, $3, $4, $5,$6)
`,
        [countermeasure_id, cmRow.psccard_id, checked_by || null, check_status, remarks || null, new Date()]
      );
      // Update cm_status for CM
      await client.query(
        `UPDATE countermeasure
         SET cm_status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [check_status, countermeasure_id]
      );

      // 4) Update the overall PSC status/ticket_stage based on the check_status decision
      //    - If accepted => PSC: status = 'Completed', ticket_stage = 'Action'
      //    - If rejected => PSC: status = 'Work in Progress', ticket_stage = 'Do'
      //    - Other statuses -> set PSC to 'For Validation' / 'Check' to reflect progress
      let pscStatus = 'For Validation';
      let pscStage = 'Check';
      if ((check_status || '').toString().toLowerCase() === 'accepted') {
        pscStatus = 'Completed';
        pscStage = 'Action';
      } else if ((check_status || '').toString().toLowerCase() === 'rejected') {
        pscStatus = 'Work in Progress';
        pscStage = 'Do';
      }

      await client.query(
        `UPDATE psccard
         SET status = $1, ticket_stage = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [pscStatus, pscStage, req.params.id]
      );


      console.log("corrective save userRespId :", userRespId);
      if (userRespId == 2) {
        await client.query(
          `UPDATE escalation_level1 SET status = $1 WHERE psccard_id = $2`,
          [pscStatus, req.params.id]
        );
      }
      if (userRespId == 3) {
        await client.query(
          `UPDATE escalation_level2 SET status = $1 WHERE psccard_id = $2`,
          [pscStatus, req.params.id]
        );
      }
      if (userRespId == 4) {
        await client.query(
          `UPDATE escalation_level3 SET status = $1 WHERE psccard_id = $2`,
          [pscStatus, req.params.id]
        );
      }


      await client.query('COMMIT');



      // // // Return refreshed PSC row for UI to reload state
      // // const pscRes = await pool.query('SELECT * FROM psccard WHERE id = $1', [req.params.id]);
      // // const joined = await mapFullPscRow(pscRes.rows[0]);
      // res.json(joined);

       const pscJoined = await client.query(
        `SELECT 
           p.*,
           c.id AS countermeasure_id,
           STRING_AGG(e.remarks, ', ') AS reasons
         FROM psccard p
         LEFT JOIN countermeasure c ON c.psccard_id = p.id
         LEFT JOIN effectiveness_check e ON e.countermeasure_id = c.id
         WHERE p.id = $1
         GROUP BY p.id, c.id;`,
        [req.params.id]
      );

      return res.json(pscJoined.rows);
      // res.json(joined);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ PUT /api/psc/:id/effectcheck error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});





app.put('/api/users/:id', async (req, res) => {
  try {
    const allowed = TABLE_COLUMNS['users'];
    const keys = Object.keys(req.body).filter(k => allowed.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const values = keys.map(k => req.body[k]);
    const setClause = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
    values.push(req.params.id);
    const q = `UPDATE users SET ${setClause} WHERE id = $${keys.length + 1} RETURNING id, username, email, plant_id, emp_code, dept_id, user_type_id, user_resp_id`;
    const result = await pool.query(q, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ PUT /api/users/:id error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// DELETE endpoints for masters and users
['department', 'position', 'line', 'machine', 'shift', 'plant', 'users', 'valuestream', 'notifications'].forEach(name => {
  app.delete(`/api/${name}/:id`, async (req, res) => {
    try {
      const q = `DELETE FROM ${name} WHERE id = $1`;
      await pool.query(q, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(`❌ DELETE /api/${name}/:id error:`, err && err.stack || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });
});

// Users: list and create
app.get('/api/users', async (req, res) => {
  try {
    const q = `SELECT u.id, u.empcode, u.username, u.usermail, u.plant_id, p.plant_name, u.dept_id, d.dept_name, u.user_type_id, ut.type_name AS user_type, u.user_resp_id, ur.resp_name, u.lock_user FROM users u LEFT JOIN plant p ON u.plant_id = p.id LEFT JOIN department d ON u.dept_id = d.id LEFT JOIN user_type ut ON u.user_type_id = ut.id LEFT JOIN user_responsibility ur ON u.user_resp_id = ur.id ORDER BY u.id DESC`;
    const result = await pool.query(q);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /api/users error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const allowed = TABLE_COLUMNS['users'] || [];
    const allowedExt = [...allowed, 'lock_user', 'empcode', 'usermail', 'plant_id', 'dept_id', 'user_type_id', 'user_resp_id'];
    const keys = Object.keys(req.body).filter(k => allowedExt.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const q = `INSERT INTO users (${keys.join(',')}) VALUES (${placeholders}) RETURNING id, empcode, username, usermail, plant_id, dept_id, user_type_id, user_resp_id, lock_user`;
    const result = await pool.query(q, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ POST /api/users error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Simple login endpoint (uses plaintext passwords currently stored in DB)
app.post('/api/login', async (req, res) => {
  try {
    const { usermail, password } = req.body || {};
    if (!usermail || !password) return res.status(400).json({ error: 'Missing credentials' });

    const q = `SELECT u.id, u.empcode, u.username, u.usermail, u.user_type_id, ut.type_name AS user_type, u.user_resp_id, ur.resp_name, ur.pages, u.dept_id, d.dept_name, u.plant_id, p.plant_name, u.lock_user FROM users u LEFT JOIN user_type ut ON u.user_type_id = ut.id LEFT JOIN user_responsibility ur ON u.user_resp_id = ur.id LEFT JOIN department d ON u.dept_id = d.id LEFT JOIN plant p ON u.plant_id = p.id WHERE u.usermail = $1 AND u.password = $2 LIMIT 1`;
    const result = await pool.query(q, [usermail, password]);
    if (!result.rows || result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    // pages may be JSONB or a stringified JSON; normalize to array
    let pages = [];
    try {
      if (user.pages == null) pages = [];
      else if (Array.isArray(user.pages)) pages = user.pages;
      else if (typeof user.pages === 'string') pages = JSON.parse(user.pages || '[]');
      else pages = Object.values(user.pages);
    } catch (e) { pages = []; }

    const out = {
      id: user.id,
      empcode: user.empcode,
      username: user.username,
      usermail: user.usermail,
      user_type_id: user.user_type_id,
      user_type: user.user_type,
      user_resp_id: user.user_resp_id,
      resp_name: user.resp_name,
      pages,
      dept_id: user.dept_id,
      dept_name: user.dept_name,
      plant_id: user.plant_id,
      plant_name: user.plant_name,
      lock_user: user.lock_user
    };
    res.json(out);
  } catch (err) {
    console.error('❌ POST /api/login error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/api/psp/ytd-metrics', async (req, res) => {
  try {
    const startDate = new Date(new Date().getFullYear(), 0, 1); // Jan 1
    const startDateStr = startDate.toISOString().split('T')[0]; // Format for SQL

    // Count all cards opened since Jan 1
    const openedQuery = `
      SELECT COUNT(*) AS count
      FROM psccard
      WHERE date >= $1
    `;
    const openedResult = await pool.query(openedQuery, [startDateStr]);
    const cardsOpened = parseInt(openedResult.rows[0].count, 10);

    // Count all cards closed (status = Completed) since Jan 1
    const closedQuery = `
      SELECT COUNT(*) AS count
      FROM psccard
      WHERE status = 'Completed' AND date >= $1
    `;
    const closedResult = await pool.query(closedQuery, [startDateStr]);
    const cardsClosed = parseInt(closedResult.rows[0].count, 10);
    res.json({ cardsOpened, cardsClosed });
  } catch (err) {
    console.error('❌ GET /api/psp/ytd-metrics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/psp/yearly-report', async (req, res) => {
  try {
    const sql = `WITH months AS (
    SELECT 
        TO_CHAR(d, 'Mon') AS month,
        EXTRACT(MONTH FROM d) AS month_no
    FROM generate_series(
        DATE '2025-01-01',
        DATE '2025-12-01',
        INTERVAL '1 month'
    ) AS d
),
teamleader AS (
    SELECT
        TO_CHAR(e1.due_time, 'Mon') AS month,
        SUM(CASE WHEN e1.status IN ('Open', 'Work in Progress', 'For Validation', 'Completed') THEN 1 ELSE 0 END) AS raised_teamleader,
        SUM(CASE WHEN e1.status IN ('Work in Progress', 'For Validation') THEN 1 ELSE 0 END) AS opened_teamleader,
        SUM(CASE WHEN e1.status = 'Completed' THEN 1 ELSE 0 END) AS closed_teamleader
    FROM escalation_level1 e1
    WHERE EXTRACT(YEAR FROM e1.due_time) = 2025
      AND e1.user_resp_id = 2
    GROUP BY TO_CHAR(e1.due_time, 'Mon')
),
vsl AS (
    SELECT
        TO_CHAR(e2.due_time, 'Mon') AS month,
        SUM(CASE WHEN e2.status IN ('Open', 'Work in Progress', 'For Validation', 'Completed') THEN 1 ELSE 0 END) AS raised_vsl,
        SUM(CASE WHEN e2.status IN ('Work in Progress', 'For Validation') THEN 1 ELSE 0 END) AS opened_vsl,
        SUM(CASE WHEN e2.status = 'Completed' THEN 1 ELSE 0 END) AS closed_vsl
    FROM escalation_level2 e2
    WHERE EXTRACT(YEAR FROM e2.due_time) = 2025
      AND e2.user_resp_id = 3
    GROUP BY TO_CHAR(e2.due_time, 'Mon')
),
plantlevel AS (
    SELECT
        TO_CHAR(e3.due_time, 'Mon') AS month,
        SUM(CASE WHEN e3.status IN ('Open', 'Work in Progress', 'For Validation', 'Completed') THEN 1 ELSE 0 END) AS raised_plantlevel,
        SUM(CASE WHEN e3.status IN ('Work in Progress', 'For Validation') THEN 1 ELSE 0 END) AS opened_plantlevel,
        SUM(CASE WHEN e3.status = 'Completed' THEN 1 ELSE 0 END) AS closed_plantlevel
    FROM escalation_level3 e3
    WHERE EXTRACT(YEAR FROM e3.due_time) = 2025
      AND e3.user_resp_id = 4
    GROUP BY TO_CHAR(e3.due_time, 'Mon')
)
SELECT
    m.month,
    COALESCE(t.raised_teamleader, 0) AS raised_teamleader,
    COALESCE(t.opened_teamleader, 0) AS opened_teamleader,
    COALESCE(t.closed_teamleader, 0) AS closed_teamleader,
    COALESCE(v.raised_vsl, 0) AS raised_vsl,
    COALESCE(v.opened_vsl, 0) AS opened_vsl,
    COALESCE(v.closed_vsl, 0) AS closed_vsl,
    COALESCE(p.raised_plantlevel, 0) AS raised_plantlevel,
    COALESCE(p.opened_plantlevel, 0) AS opened_plantlevel,
    COALESCE(p.closed_plantlevel, 0) AS closed_plantlevel
FROM months m
LEFT JOIN teamleader t ON m.month = t.month
LEFT JOIN vsl v ON m.month = v.month
LEFT JOIN plantlevel p ON m.month = p.month
ORDER BY m.month_no;
`;

    const result = await pool.query(sql);
    const data = result.rows.map(row => {
      // convert DB counts (may come as strings) to numbers
      const raised_teamleader = Number(row.raised_teamleader) || 0;
      const closed_teamleader = Number(row.closed_teamleader) || 0;
      const closed_vsl = Number(row.closed_vsl) || 0;
      const closed_plantlevel = Number(row.closed_plantlevel) || 0;


      const totalClosed = closed_teamleader + closed_vsl + closed_plantlevel;
      let pending = raised_teamleader - totalClosed;
      if (pending < 0) pending = 0;
      console.log('pending : ', pending);
      let competency = 0;
      const completed = raised_teamleader - pending;
      competency = Math.ceil((completed / raised_teamleader) * 100);
      console.log("Competency % :", competency);
      return {
        month: row.month,
        teamLeader: {
          raised: row.raised_teamleader,
          tl_closed: row.closed_teamleader,
          tl_opened: row.opened_teamleader,
        },
        valueStreamLeader: {
          vsl_escalated: row.raised_vsl,
          vsl_closed: row.closed_vsl,
          vsl_opened: row.opened_vsl
        },
        plantLevel: {
          plant_escalated: row.raised_plantlevel,
          plant_closed: row.closed_plantlevel,
          plant_opened: row.opened_plantlevel
        },
        pending: pending,
        competency: competency
      };
    });

    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/psp/yearly-report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


