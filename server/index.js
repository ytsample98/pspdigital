// server/index.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// Allowed columns per table (used to whitelist fields from frontend)
const TABLE_COLUMNS = {
  notifications: ['name', 'trigger', 'responsibility', 'link', 'message'],
  organization: ['short_name','business_group_name','effective_from','effective_to','financial_year','status','address_line1','address_line2','address_line3','area','country','state','city','zipcode','landline','mobile','fax','website','email','twitter','company_reg_no','place_of_old_reg','tax_reg_no','currency','logo_url'],
  department: ['dept_code','dept_name','created_by','created_date'],
  valuestream: ['vl_code','vl_name','created_by','created_date'],
  position: ['position_code','position_name','created_by','created_date'],
  line: ['line_code','line_name','vl_code','created_by','created_date'],
  machine: ['machine_name','machine_no','machine_type','created_by','created_date'],
  shift: ['shift_name','shift_type','start_time','end_time','created_by','created_date'],
  plant: ['plant_name','plant_type','created_by','created_date'],
  users: ['plant_id','emp_code','username','email','password','dept_id','user_type_id','user_resp_id','created_by','created_date']
};

// normalize users columns to match current DB (empcode, usermail, lock_user)
TABLE_COLUMNS['users'] = ['plant_id','empcode','username','usermail','password','dept_id','user_type_id','user_resp_id','lock_user','created_by','created_date'];

// add user masters
TABLE_COLUMNS['user_type'] = ['type_name'];
TABLE_COLUMNS['user_responsibility'] = ['resp_name','pages'];
TABLE_COLUMNS['escalation'] = ['escalation_id','escalation_name','time_duration','authority_id'];

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
      'short_name','business_group_name','effective_from','effective_to','financial_year','status',
      'address_line1','address_line2','address_line3','area','country','state','city','zipcode',
      'landline','mobile','fax','website','email','twitter',
      'company_reg_no','place_of_old_reg','tax_reg_no','currency','logo_url'
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
      'short_name','business_group_name','effective_from','effective_to','financial_year','status',
      'address_line1','address_line2','address_line3','area','country','state','city','zipcode',
      'landline','mobile','fax','website','email','twitter',
      'company_reg_no','place_of_old_reg','tax_reg_no','currency','logo_url'
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
      const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
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
      const setClause = keys.map((k, i) => `${k}=$${i+1}`).join(',');
      values.push(req.params.id);
      const q = `UPDATE ${name} SET ${setClause} WHERE id = $${keys.length+1} RETURNING *`;
      const result = await pool.query(q, values);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(`❌ PUT /api/${name}/:id error:`, err && err.stack || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });
};

['department','position','line','machine','shift','plant','valuestream','user_type','user_responsibility','escalation','notifications'].forEach(createMasterEndpoints);

// --- PSC endpoints ---
// helper to map DB row (snake_case) to frontend-friendly camelCase
// Helper: join all PSC related data
const mapFullPscRow = async (pscRow) => {
  if (!pscRow) return null;
  const id = pscRow.id;
  // Get corrective action and department
  const correctiveQ = `SELECT c.*, d.dept_name FROM corrective c LEFT JOIN department d ON c.corrective_assign_to = d.id WHERE c.psc_id = $1`;
  const correctiveRes = await pool.query(correctiveQ, [id]);
  const corrective = correctiveRes.rows[0] || null;

  // Get root cause
  const rootCauseQ = `SELECT * FROM root_cause WHERE psccard_id = $1`;
  const rootCauseRes = await pool.query(rootCauseQ, [id]);
  const rootCause = rootCauseRes.rows[0] || null;

  // Get countermeasures
  let countermeasures = [];
  if (rootCause) {
    const cmQ = `SELECT * FROM countermeasure WHERE root_cause_id = $1`;
    const cmRes = await pool.query(cmQ, [rootCause.id]);
    countermeasures = cmRes.rows;
  }

  // Get effectiveness check
  const effQ = `SELECT * FROM effectiveness_check WHERE psc_id = $1`;
  const effRes = await pool.query(effQ, [id]);
  const effectivenessCheck = effRes.rows[0] || null;

  // Compose output
  return {
    ...pscRow,
    problemNumber: pscRow.problem_number,
    initiatorName: pscRow.initiator_name,
    valueStreamLine: pscRow.value_stream_line,
    lineCode: pscRow.line_code,
    shortDescription: pscRow.short_description,
    problemDescription: pscRow.problem_description,
    qtyAffected: pscRow.qty_affected,
    partAffected: pscRow.part_affected,
    ticketStage: pscRow.ticket_stage || pscRow.ticketStage,
    correctiveAction: corrective,
    rootCause: rootCause ? { ...rootCause, countermeasures } : null,
    effectivenessCheck,
  };
};
app.get('/api/psc', async (req, res) => {
  try {
    const { status } = req.query;
    let q = 'SELECT * FROM psccard';
    const params = [];
    if (status) {
      q += ' WHERE status = $1';
      params.push(status);
    }
    q += ' ORDER BY id DESC';
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

app.post('/api/psc', async (req, res) => {
  try {
    // accept keys directly (we assume frontend sends snake_case as in PSCList)
    const allowed = [
      'problem_number', 'initiator_name', 'date', 'shift', 'value_stream_line',
      'line_id', 'short_description', 'problem_description', 'qty_affected',
      'part_affected', 'supplier', 'status', 'ticket_stage', 'created_by'
    ];
    const keys = Object.keys(req.body).filter(k => allowed.includes(k));
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    // Insert into psccard table
    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    const q = `INSERT INTO psccard (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`;
    
    // Execute insert and get related data
    const result = await pool.query(q, values);
    const psc = result.rows[0];
    
    // Get related shift and line names
    const joinQuery = `
      SELECT p.*, s.shift_name, l.line_name, l.line_code
      FROM psccard p
      LEFT JOIN shift s ON p.shift = s.id
      LEFT JOIN line l ON p.line_id = l.id
      WHERE p.id = $1
    `;
    const joined = await pool.query(joinQuery, [psc.id]);
    res.json(await mapFullPscRow(joined.rows[0]));
  } catch (err) {
    console.error('❌ POST /api/psc error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// generic PSC update (partial)
app.put('/api/psc/:id', async (req, res) => {
  try {
    // whitelist allowed psc columns
  const allowed = ['problem_number','initiator_name','date','shift','value_stream_line','line_code','short_description','problem_description','qty_affected','part_affected','supplier','status','ticket_stage','corrective_action','root_cause','corrective_action_by','root_cause_by','corrective_action_date','root_cause_date','effectiveness_checked','effectiveness_remarks','effectiveness_date'];
    const keys = Object.keys(req.body).filter(k => allowed.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const values = keys.map(k => req.body[k]);
    const setClause = keys.map((k, i) => `${k}=$${i+1}`).join(',');
    values.push(req.params.id);
    const q = `UPDATE psc SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length+1} RETURNING *`;
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
    const { action_taken, done_by, corrective_assign_to, corrective_comments } = req.body;
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
    const { why1, why2, why3, why4, why5, filled_by, countermeasures } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Upsert root_cause row
      const rcResult = await client.query(
        `INSERT INTO root_cause 
        (psccard_id, why1, why2, why3, why4, why5, filled_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (psccard_id) 
        DO UPDATE SET 
          why1 = $2, why2 = $3, why3 = $4, why4 = $5, why5 = $6,
          filled_by = $7, updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [req.params.id, why1, why2, why3, why4, why5, filled_by]
      );

      const rootCauseRow = rcResult.rows[0];

      // If countermeasures provided, replace existing countermeasures for this root_cause
      if (Array.isArray(countermeasures)) {
        // delete existing CM rows for this root cause (simple replacement)
        await client.query('DELETE FROM countermeasure WHERE root_cause_id = $1', [rootCauseRow.id]);

        // insert new ones
        for (let i = 0; i < countermeasures.length; i++) {
          const cm = countermeasures[i] || {};
          const vals = [
            rootCauseRow.id,
            cm.countermeasure || null,
            cm.targetDate || null,
            cm.type || null,
            cm.actionRemarks || null,
            cm.assignTo || null,
            cm.comments || null,
            cm.status || 'Pending',
            cm.acceptedBy || cm.accepted_by || null,
            cm.acceptedAt || cm.accepted_at || null,
            cm.rejection_reason || null,
            cm.rejectedBy || cm.rejected_by || null,
            cm.rejectedAt || cm.rejected_at || null,
            new Date(),
            new Date()
          ];
          const placeholders = vals.map((_, idx) => `$${idx + 1}`).join(',');
          const q = `INSERT INTO countermeasure (
            root_cause_id,
            countermeasure,
            counter_target_date,
            counter_type,
            counter_action_remarks,
            counter_assign_to,
            counter_comments,
            status,
            accepted_by,
            accepted_at,
            rejection_reason,
            rejected_by,
            rejected_at,
            created_at,
            updated_at
          ) VALUES (${placeholders})`;
          await client.query(q, vals);
        }
      }

      // Update PSC status and stage
      await client.query(
        `UPDATE psccard SET status = $1, ticket_stage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        ['For Validation', 'Check', req.params.id]
      );

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

// effectiveness check
app.put('/api/psc/:id/effectcheck', async (req, res) => {
  try {
    const { status, checked_by, checked_remarks } = req.body;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate: must have at least one accepted countermeasure
      const rootCauseQ = `SELECT id FROM root_cause WHERE psccard_id = $1`;
      const rootCauseRes = await pool.query(rootCauseQ, [req.params.id]);
      const rootCause = rootCauseRes.rows[0];
      let hasAccepted = false;
      if (rootCause) {
        const cmQ = `SELECT status FROM countermeasure WHERE root_cause_id = $1`;
        const cmRes = await pool.query(cmQ, [rootCause.id]);
        hasAccepted = cmRes.rows.some(row => (row.status || '').toLowerCase() === 'accepted');
      }
      if (!hasAccepted) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No accepted countermeasure found. Effectiveness check not allowed.' });
      }

      // Update or insert effectiveness check
      await client.query(
        `INSERT INTO effectiveness_check 
        (psc_id, status, check_date, checked_by, checked_remarks)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (psc_id) 
        DO UPDATE SET 
          status = $2, check_date = $3, checked_by = $4,
          checked_remarks = $5, updated_at = CURRENT_TIMESTAMP`,
        [req.params.id, status, new Date(), checked_by, checked_remarks]
      );

      // Update PSC status
      await client.query(
        `UPDATE psccard SET 
         status = $1, 
         ticket_stage = $2, 
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [status === 'Accepted' ? 'Completed' : 'For Validation', 
         status === 'Accepted' ? 'Action' : 'Check',
         req.params.id]
      );

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
    console.error('❌ PUT /api/psc/:id/effectcheck error:', err && err.stack || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// update user (partial)
app.put('/api/users/:id', async (req, res) => {
  try {
    const allowed = TABLE_COLUMNS['users'];
    const keys = Object.keys(req.body).filter(k => allowed.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const values = keys.map(k => req.body[k]);
    const setClause = keys.map((k, i) => `${k}=$${i+1}`).join(',');
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
['department','position','line','machine','shift','plant','users','valuestream','notifications'].forEach(name => {
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
    const allowedExt = [...allowed, 'lock_user','empcode','usermail','plant_id','dept_id','user_type_id','user_resp_id'];
    const keys = Object.keys(req.body).filter(k => allowedExt.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
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

    console.log('YTD Metrics:', { cardsOpened, cardsClosed });

    res.json({ cardsOpened, cardsClosed });
  } catch (err) {
    console.error('❌ GET /api/psp/ytd-metrics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/psp/competency-report', async (req, res) => {
  try {
    const sql = `
      WITH user_roles AS (
        SELECT id AS user_id, user_resp_id FROM users
      ),
      psc_with_role AS (
        SELECT p.id, p.date, p.status, u.user_resp_id,
               ec.status AS effect_status,
               corr.corrective_assign_to
        FROM psccard p
        JOIN user_roles u ON p.created_by = u.user_id
        LEFT JOIN effectiveness_check ec ON ec.psc_id = p.id
        LEFT JOIN corrective corr ON corr.psc_id = p.id
      ),
      monthly AS (
        SELECT date_trunc('month', date) AS m, user_resp_id,
          COUNT(*) FILTER (WHERE user_resp_id = 2) AS raised,
          COUNT(*) FILTER (WHERE status = 'Open') AS opened,
          COUNT(*) FILTER (WHERE effect_status = 'Accepted') AS closed,
          COUNT(*) FILTER (WHERE corrective_assign_to IS NOT NULL AND user_resp_id IN (3,4)) AS escalated
        FROM psc_with_role
        GROUP BY m, user_resp_id
      )
      SELECT to_char(m, 'Mon-YY') AS month, user_resp_id,
             COALESCE(raised,0) AS cards_raised,
             COALESCE(opened,0) AS cards_opened,
             COALESCE(closed,0) AS cards_closed,
             COALESCE(escalated,0) AS cards_escalated
      FROM monthly
      ORDER BY m DESC, user_resp_id;
    `;

    const result = await pool.query(sql);

    const ROLE_MAP = { 2: 'TL', 3: 'VSL', 4: 'Plant Head' };
    const out = result.rows.map(r => ({
      month: r.month,
      role: ROLE_MAP[r.user_resp_id] || `Role-${r.user_resp_id}`,
      cards_raised: Number(r.cards_raised),
      cards_opened: Number(r.cards_opened),
      cards_closed: Number(r.cards_closed),
      cards_escalated: Number(r.cards_escalated)
    }));
    console.log('Competency Report:', out); 

    res.json(out);
    
  } catch (err) {
    console.error('❌ GET /api/psp/competency-report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


