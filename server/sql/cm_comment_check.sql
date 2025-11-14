/*384 in index*/
CREATE TABLE IF NOT EXISTS root_cause (
  id SERIAL PRIMARY KEY,
  psccard_id INTEGER NOT NULL REFERENCES psccard(id) ON DELETE CASCADE,
  why1 TEXT,
  why2 TEXT,
  why3 TEXT,
  why4 TEXT,
  why5 TEXT,
  final_cause TEXT,
  filled_by INTEGER REFERENCES users(id),
  filled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_psc_root_cause UNIQUE (psccard_id)
);

CREATE TABLE IF NOT EXISTS countermeasure (
  id SERIAL PRIMARY KEY,
  root_cause_id INTEGER NOT NULL REFERENCES root_cause(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES department(id),-- Kept this field as it may be used for initial 'Quick Reassign'
  assigned_remarks TEXT, -- Kept this field as it may be used for initial 'Quick Reassign' remarks
  description TEXT NOT NULL,
  target_date DATE,
  type VARCHAR(100),
  created_by INTEGER REFERENCES users(id),
  cm_status VARCHAR(50) DEFAULT 'Pending'
      CHECK (cm_status IN ('Pending', 'For Validation', 'Accepted', 'Rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS countermeasure_log (
    id SERIAL PRIMARY KEY,
    countermeasure_id INTEGER NOT NULL REFERENCES countermeasure(id) ON DELETE CASCADE,
    log_type VARCHAR(50) NOT NULL
        CHECK (log_type IN ('User Comment', 'Acceptance Remark', 'Rejection Remark')),
    log_text TEXT NOT NULL, -- The user comment OR the acceptance/rejection remark.
    logged_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS effectiveness_check (
  id SERIAL PRIMARY KEY,
  -- Links to the countermeasure (CM) that is being checked
  countermeasure_id INTEGER NOT NULL
      REFERENCES countermeasure(id) ON DELETE CASCADE,
  checked_by INTEGER REFERENCES users(id),
  check_status VARCHAR(50) NOT NULL
      CHECK (check_status IN ('Pending', 'For Validation', 'Accepted', 'Rejected')),
  remarks TEXT, -- The official reason/remark for this specific check attempt (Reject/Accept)
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
/*543 in index*/


CREATE TABLE escalation_level1 (
    id SERIAL PRIMARY KEY,
    due_time TIMESTAMP,
    psccard_id INT NOT NULL REFERENCES psccard(id),
    escalation_id INT NOT NULL REFERENCES escalation(id),
    user_resp_id INT NOT NULL REFERENCES user_responsibility(id),
    status VARCHAR(50) DEFAULT 'Open',
); 

CREATE TABLE escalation_level2 (
    id SERIAL PRIMARY KEY,
    psccard_id INT NOT NULL REFERENCES psccard(id),
    escalation_id INT NOT NULL REFERENCES escalation(id),
    user_resp_id INT NOT NULL REFERENCES user_responsibility(id),
    status VARCHAR(50) DEFAULT 'Open',
    timestamp_escalated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_time TIMESTAMP
);

CREATE TABLE escalation_level3 (
    id SERIAL PRIMARY KEY,
    psccard_id INT NOT NULL REFERENCES psccard(id),
    escalation_id INT NOT NULL REFERENCES escalation(id),
    user_resp_id INT NOT NULL REFERENCES user_responsibility(id),
    status VARCHAR(50) DEFAULT 'Open',
    timestamp_escalated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_time TIMESTAMP
);