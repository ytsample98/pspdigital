-- SQL: create_tables.sql
-- Run this in your psp_db to create required tables

CREATE TABLE IF NOT EXISTS department (
  id SERIAL PRIMARY KEY,
  dept_code VARCHAR(50) NOT NULL,
  dept_name VARCHAR(200) NOT NULL,
  created_by VARCHAR(100),
  created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS position (
  id SERIAL PRIMARY KEY,
  position_code VARCHAR(50) NOT NULL,
  position_name VARCHAR(200) NOT NULL,
  created_by VARCHAR(100),
  created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS valuestream (
  id SERIAL PRIMARY KEY,
  vl_code VARCHAR(50) NOT NULL,
  vl_name VARCHAR(200) NOT NULL,
  created_by VARCHAR(100),
  created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS line (
  id SERIAL PRIMARY KEY,
  line_code VARCHAR(50) NOT NULL,
  line_name VARCHAR(200) NOT NULL,
  vl_code VARCHAR(50),
  created_by VARCHAR(100),
  created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS machine (
  id SERIAL PRIMARY KEY,
  machine_name VARCHAR(200) NOT NULL,
  machine_no VARCHAR(100),
  machine_type VARCHAR(100),
  created_by VARCHAR(100),
  created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS shift (
  id SERIAL PRIMARY KEY,
  shift_name VARCHAR(100) NOT NULL UNIQUE,
  shift_type VARCHAR(100),
  start_time TIME,
  end_time TIME,
  created_by VARCHAR(100),
  created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS plant (
  id SERIAL PRIMARY KEY,
  plant_name VARCHAR(200) NOT NULL,
  plant_type VARCHAR(100),
  created_by VARCHAR(100),
  created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS user_type (
  id SERIAL PRIMARY KEY,
  type_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_responsibility (
  id SERIAL PRIMARY KEY,
  resp_name VARCHAR(200) NOT NULL,
  pages JSONB
);

-- escalation matrix
CREATE TABLE IF NOT EXISTS escalation (
  id SERIAL PRIMARY KEY,
  escalation_id VARCHAR(100) NOT NULL,
  escalation_name VARCHAR(200) NOT NULL,
  time_duration VARCHAR(100),
  authority_id INTEGER REFERENCES user_responsibility(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  plant_id INTEGER REFERENCES plant(id),
  empcode VARCHAR(50),
  username VARCHAR(200) NOT NULL,
  usermail VARCHAR(200) NOT NULL,
  password VARCHAR(200) NOT NULL,
  dept_id INTEGER REFERENCES department(id),
  user_type_id INTEGER REFERENCES user_type(id),
  user_resp_id INTEGER REFERENCES user_responsibility(id),
  lock_user BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100),
  created_date DATE DEFAULT CURRENT_DATE
);

-- organization table (if not present)
CREATE TABLE IF NOT EXISTS organization (
  id SERIAL PRIMARY KEY,
  short_name VARCHAR(100),
  business_group_name VARCHAR(200),
  effective_from DATE,
  effective_to DATE,
  financial_year VARCHAR(50),
  status VARCHAR(50),
  address_line1 VARCHAR(200),
  address_line2 VARCHAR(200),
  address_line3 VARCHAR(200),
  area VARCHAR(200),
  country VARCHAR(100),
  state VARCHAR(100),
  city VARCHAR(100),
  zipcode VARCHAR(30),
  landline VARCHAR(50),
  mobile VARCHAR(50),
  fax VARCHAR(50),
  website VARCHAR(200),
  email VARCHAR(200),
  twitter VARCHAR(200),
  company_reg_no VARCHAR(100),
  place_of_old_reg VARCHAR(200),
  tax_reg_no VARCHAR(100),
  currency VARCHAR(50),
  logo_url TEXT
);

-- PSC Card main table

CREATE TABLE IF NOT EXISTS psccard (
  id SERIAL PRIMARY KEY,
  problem_number VARCHAR(100) NOT NULL UNIQUE,
  initiator_name VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  shift INTEGER REFERENCES shift(id),  -- use shift.id
  line_id INTEGER REFERENCES line(id), -- use line.id
  value_stream_line VARCHAR(100),
  short_description TEXT,
  problem_description TEXT NOT NULL,
  qty_affected VARCHAR(50),
  part_affected VARCHAR(200),
  supplier VARCHAR(200),
  status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Work in Progress', 'Completed', 'Closed','For Validation')),
  ticket_stage VARCHAR(50) DEFAULT 'Plan' CHECK (ticket_stage IN ('Plan', 'Action', 'Check','Do')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS root_cause (
  id SERIAL PRIMARY KEY,
  psccard_id INTEGER NOT NULL REFERENCES psccard(id) ON DELETE CASCADE,
  why1 TEXT,
  why2 TEXT,
  why3 TEXT,
  why4 TEXT,
  why5 TEXT,
  filled_by INTEGER REFERENCES users(id),
  filled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_psc_root_cause UNIQUE (psccard_id)
);
CREATE TABLE IF NOT EXISTS countermeasure (
  id SERIAL PRIMARY KEY,
  root_cause_id INTEGER NOT NULL REFERENCES root_cause(id) ON DELETE CASCADE,
  countermeasure TEXT NOT NULL,
  counter_target_date DATE,
  counter_type VARCHAR(100),
  counter_action_remarks TEXT,
  counter_assign_to INTEGER REFERENCES department(id),
  counter_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Corrective action table
CREATE TABLE IF NOT EXISTS corrective (
  id SERIAL PRIMARY KEY,
  psc_id INTEGER NOT NULL REFERENCES psccard(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  done_by INTEGER REFERENCES users(id),
  corrective_assign_to INTEGER REFERENCES department(id),
  corrective_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_psc_corrective UNIQUE (psc_id)
);

-- Effectiveness check table
CREATE TABLE IF NOT EXISTS effectiveness_check (
  id SERIAL PRIMARY KEY,
  psc_id INTEGER NOT NULL REFERENCES psccard(id) ON DELETE CASCADE,
  status VARCHAR(50) CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
  check_date DATE,
  checked_by INTEGER REFERENCES users(id),
  checked_remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_psc_effectiveness UNIQUE (psc_id)
);

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update timestamp triggers
CREATE TRIGGER update_psccard_timestamp BEFORE UPDATE ON psccard
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER update_root_cause_timestamp BEFORE UPDATE ON root_cause
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER update_corrective_timestamp BEFORE UPDATE ON corrective
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER update_effectiveness_timestamp BEFORE UPDATE ON effectiveness_check
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
