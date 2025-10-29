const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'psp_db',
  password: 'admin123',
  port: 5432,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert master data
    await client.query(`INSERT INTO plant (id, plant_name) VALUES (1, 'Main Plant') ON CONFLICT DO NOTHING;`);
    await client.query(`INSERT INTO user_type (id, type_name) VALUES (1, 'Admin'), (2, 'Manager'), (3, 'Supervisor') ON CONFLICT DO NOTHING;`);
    await client.query(`INSERT INTO user_responsibility (id, resp_name) VALUES (1, 'Plant Head'), (2, 'TL'), (3, 'VSL'), (4, 'Other') ON CONFLICT DO NOTHING;`);

    // 2. Insert users
    await client.query(`
      INSERT INTO users (id, plant_id, empcode, username, usermail, password, dept_id, user_type_id, user_resp_id, lock_user, created_by, created_date)
      VALUES
        (2, 1, 'U6157552', 'Ganesh', 'ganeshOE@gmail.com', 'ganeshoe', 1, 2, 1, false, 1, '2025-10-18'),
        (4, 1, 'U4219067', 'Shiva', 'shivaOE@gmail.com', 'shivaOE', 3, 2, 1, false, 1, '2025-10-19'),
        (5, 1, 'U8780146', 'testvsl', 'testvsl@gmail.com', 'testvsl', 3, 3, 3, false, 1, '2025-10-22'),
        (6, 1, 'U7660765', 'sampleTL', 'sampletl@gmail.com', 'sampletl', 2, 1, 2, false, 1, '2025-10-22'),
        (8, 1, 'U2362685', 'Shiva', 'shivaph@gmail.com', 'shivaph', 4, 1, 4, false, 1, '2025-10-27')
      ON CONFLICT DO NOTHING;
    `);

    // 3. Insert psccard
    await client.query(`
      INSERT INTO psccard (id, problem_number, initiator_name, date, shift, value_stream_line, line_id, short_description, problem_description, qty_affected, part_affected, supplier, status, ticket_stage, created_by)
      VALUES
        (101, 'P001', 'Ganesh', '2025-10-18', 1, 'VS1', 1, 'Issue A', 'Desc A', 10, 'PartX', 'Supplier1', 'Open', 'Raised', 2),
        (102, 'P002', 'Shiva', '2025-10-19', 1, 'VS2', 2, 'Issue B', 'Desc B', 5, 'PartY', 'Supplier2', 'Completed', 'Closed', 4),
        (103, 'P003', 'testvsl', '2025-10-22', 2, 'VS3', 3, 'Issue C', 'Desc C', 8, 'PartZ', 'Supplier3', 'Open', 'Escalated', 5),
        (104, 'P004', 'sampleTL', '2025-10-22', 2, 'VS4', 4, 'Issue D', 'Desc D', 12, 'PartW', 'Supplier4', 'Completed', 'Closed', 6)
      ON CONFLICT DO NOTHING;
    `);

    // 4. Insert root_cause
    await client.query(`
      INSERT INTO root_cause (id, psccard_id, why1, why2, why3, why4, why5, filled_by)
      VALUES
        (201, 101, 'Why1-A', 'Why2-A', 'Why3-A', 'Why4-A', 'Why5-A', 'Ganesh'),
        (202, 103, 'Why1-C', 'Why2-C', 'Why3-C', 'Why4-C', 'Why5-C', 'testvsl')
      ON CONFLICT DO NOTHING;
    `);

    // 5. Insert corrective
    await client.query(`
      INSERT INTO corrective (id, psc_id, action_taken, done_by, corrective_assign_to, corrective_comments)
      VALUES
        (301, 101, 'Action A', 'Ganesh', 1, 'Comments A'),
        (302, 103, 'Action C', 'testvsl', 3, 'Comments C')
      ON CONFLICT DO NOTHING;
    `);

    // 6. Insert effectiveness_check
    await client.query(`
      INSERT INTO effectiveness_check (id, psc_id, status, check_date, checked_by, checked_remarks)
      VALUES
        (401, 102, 'Accepted', '2025-10-20', 'Shiva', 'Remarks B'),
        (402, 104, 'Accepted', '2025-10-23', 'sampleTL', 'Remarks D')
      ON CONFLICT DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✅ Seed data inserted successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();