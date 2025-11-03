
-- 4) Refresh function: computes monthwise aggregates using current-state counts
--    Business rules implemented (per your request):
--      - cards_raised: count of psccard rows whose "date" column is in the month
--      - cards_closed: among cards raised that month, how many currently have status = 'Completed'
--      - cards_opened: among cards raised that month, how many currently have status IN ('Work in Progress', 'For Validation')
--      - cards_escalated: if escalation history exists, count of escalation-history rows whose changed_at is in the month
--                        otherwise fallback to count of cards raised in month that currently have escalation_id IS NOT NULL
--      - pending: cards_raised - cards_closed
--      - closure_percent: (cards_closed/cards_raised)*100, NULL when cards_raised = 0
--
--    NOTE: these counts are "monthwise by creation date, measured against current status/escalation state"
--          If you prefer counting "current status irrespective of creation month" or "transitions" change the queries below.

CREATE OR REPLACE FUNCTION refresh_psp_competency_monthly(start_date date DEFAULT NULL, end_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  s date;
  e date;
  m date;
  have_escalation_history boolean;
BEGIN
  -- date range defaults to month of earliest psccard to now
  IF start_date IS NULL THEN
    SELECT date_trunc('month', coalesce(min(date), now()))::date INTO s FROM psccard;
    IF s IS NULL THEN s := date_trunc('month', now())::date; END IF;
  ELSE
    s := date_trunc('month', start_date)::date;
  END IF;

  IF end_date IS NULL THEN
    e := date_trunc('month', now())::date;
  ELSE
    e := date_trunc('month', end_date)::date;
  END IF;

  -- detect if escalation history table has rows
  SELECT EXISTS(SELECT 1 FROM psccard_escalation_history) INTO have_escalation_history;

  m := s;
  WHILE m <= e LOOP
    WITH month_range AS (
      SELECT m::date AS month_start,
             (m + interval '1 month')::date AS month_end
    ),
    raised AS (
      SELECT count(*) AS cnt
      FROM psccard c
      JOIN month_range r ON TRUE
      WHERE c.date >= r.month_start AND c.date < r.month_end
    ),
    closed AS (
      -- closed among cards raised that month based on their current status
      SELECT count(*) AS cnt
      FROM psccard c
      JOIN month_range r ON TRUE
      WHERE c.date >= r.month_start AND c.date < r.month_end
        AND (c.status ILIKE 'Completed')
    ),
    opened AS (
      SELECT count(*) AS cnt
      FROM psccard c
      JOIN month_range r ON TRUE
      WHERE c.date >= r.month_start AND c.date < r.month_end
        AND (c.status ILIKE 'Work in Progress' OR c.status ILIKE 'For Validation')
    ),
    escalated_from_history AS (
      SELECT count(*) AS cnt
      FROM psccard_escalation_history eh
      JOIN month_range r ON TRUE
      WHERE eh.changed_at >= r.month_start AND eh.changed_at < r.month_end
        AND (eh.from_escalation_id IS DISTINCT FROM eh.to_escalation_id)
    ),
    escalated_from_current AS (
      -- fallback: cards created in the month that currently have an escalation_id set
      SELECT count(*) AS cnt
      FROM psccard c
      JOIN month_range r ON TRUE
      WHERE c.date >= r.month_start AND c.date < r.month_end
        AND c.escalation_id IS NOT NULL
    )
    INSERT INTO psp_competency_monthly (year, month, month_start, cards_raised, cards_closed, cards_opened, cards_escalated, pending, closure_percent)
    SELECT
      EXTRACT(YEAR FROM m)::int AS year,
      EXTRACT(MONTH FROM m)::int AS month,
      m::date AS month_start,
      COALESCE((SELECT cnt FROM raised), 0) AS cards_raised,
      COALESCE((SELECT cnt FROM closed), 0) AS cards_closed,
      COALESCE((SELECT cnt FROM opened), 0) AS cards_opened,
      CASE WHEN have_escalation_history THEN COALESCE((SELECT cnt FROM escalated_from_history), 0)
           ELSE COALESCE((SELECT cnt FROM escalated_from_current), 0)
      END AS cards_escalated,
      (COALESCE((SELECT cnt FROM raised), 0) - COALESCE((SELECT cnt FROM closed), 0)) AS pending,
      CASE WHEN COALESCE((SELECT cnt FROM raised), 0) = 0 THEN NULL
           ELSE ROUND(100.0 * COALESCE((SELECT cnt FROM closed), 0) / COALESCE((SELECT cnt FROM raised), 0), 2)
      END AS closure_percent
    ON CONFLICT (year, month) DO UPDATE
      SET cards_raised    = EXCLUDED.cards_raised,
          cards_closed    = EXCLUDED.cards_closed,
          cards_opened    = EXCLUDED.cards_opened,
          cards_escalated = EXCLUDED.cards_escalated,
          pending         = EXCLUDED.pending,
          closure_percent = EXCLUDED.closure_percent;

    m := (m + interval '1 month')::date;
  END LOOP;
END;
$$;

-- 5) Optional: convenience initial population
-- SELECT refresh_psp_competency_monthly();
ALTER TABLE psccard
  ADD COLUMN IF NOT EXISTS escalation_id INTEGER REFERENCES escalation(id);


CREATE TABLE IF NOT EXISTS psccard_escalation_history (
  id SERIAL PRIMARY KEY,
  psccard_id INTEGER NOT NULL REFERENCES psccard(id) ON DELETE CASCADE,
  from_escalation_id INTEGER REFERENCES escalation(id),
  to_escalation_id INTEGER REFERENCES escalation(id),
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO psp_competency_monthly 
(year, month, month_start, cards_raised, cards_closed, cards_opened, cards_escalated, pending, closure_percent)
VALUES (2025, 10, '2025-10-01', 10, 8, 9, 1, 2, 80);


CREATE TABLE IF NOT EXISTS psp_competency_monthly (
  year            int NOT NULL,
  month           int NOT NULL,
  month_start     date NOT NULL,
  cards_raised    int NOT NULL DEFAULT 0,
  cards_closed    int NOT NULL DEFAULT 0,
  cards_opened    int NOT NULL DEFAULT 0,
  cards_escalated int NOT NULL DEFAULT 0,
  pending         int NOT NULL DEFAULT 0,
  closure_percent numeric(5,2),
  PRIMARY KEY (year, month)
);

CREATE OR REPLACE FUNCTION refresh_psp_competency_monthly(start_date date DEFAULT NULL, end_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  s date;
  e date;
  m date;
  have_escalation_history boolean;
BEGIN
  -- date range defaults to month of earliest psccard to now
  IF start_date IS NULL THEN
    SELECT date_trunc('month', coalesce(min(date), now()))::date INTO s FROM psccard;
    IF s IS NULL THEN s := date_trunc('month', now())::date; END IF;
  ELSE
    s := date_trunc('month', start_date)::date;
  END IF;

  IF end_date IS NULL THEN
    e := date_trunc('month', now())::date;
  ELSE
    e := date_trunc('month', end_date)::date;
  END IF;

  -- detect if escalation history table has rows
  SELECT EXISTS(SELECT 1 FROM psccard_escalation_history) INTO have_escalation_history;

  m := s;
  WHILE m <= e LOOP
    WITH month_range AS (
      SELECT m::date AS month_start,
             (m + interval '1 month')::date AS month_end
    ),
    raised AS (
      SELECT count(*) AS cnt
      FROM psccard c
      JOIN month_range r ON TRUE
      WHERE c.date >= r.month_start AND c.date < r.month_end
    ),
    closed AS (
      -- closed among cards raised that month based on their current status
      SELECT count(*) AS cnt
      FROM psccard c
      JOIN month_range r ON TRUE
      WHERE c.date >= r.month_start AND c.date < r.month_end
        AND (c.status ILIKE 'Completed')
    ),
    opened AS (
      SELECT count(*) AS cnt
      FROM psccard c
      JOIN month_range r ON TRUE
      WHERE c.date >= r.month_start AND c.date < r.month_end
        AND (c.status ILIKE 'Work in Progress' OR c.status ILIKE 'For Validation')
    ),
    escalated_from_history AS (
      SELECT count(*) AS cnt
      FROM psccard_escalation_history eh
      JOIN month_range r ON TRUE
      WHERE eh.changed_at >= r.month_start AND eh.changed_at < r.month_end
        AND (eh.from_escalation_id IS DISTINCT FROM eh.to_escalation_id)
    ),
    escalated_from_current AS (
      -- fallback: cards created in the month that currently have an escalation_id set
      SELECT count(*) AS cnt
      FROM psccard c
      JOIN month_range r ON TRUE
      WHERE c.date >= r.month_start AND c.date < r.month_end
        AND c.escalation_id IS NOT NULL
    )
    INSERT INTO psp_competency_monthly (year, month, month_start, cards_raised, cards_closed, cards_opened, cards_escalated, pending, closure_percent)
    SELECT
      EXTRACT(YEAR FROM m)::int AS year,
      EXTRACT(MONTH FROM m)::int AS month,
      m::date AS month_start,
      COALESCE((SELECT cnt FROM raised), 0) AS cards_raised,
      COALESCE((SELECT cnt FROM closed), 0) AS cards_closed,
      COALESCE((SELECT cnt FROM opened), 0) AS cards_opened,
      CASE WHEN have_escalation_history THEN COALESCE((SELECT cnt FROM escalated_from_history), 0)
           ELSE COALESCE((SELECT cnt FROM escalated_from_current), 0)
      END AS cards_escalated,
      (COALESCE((SELECT cnt FROM raised), 0) - COALESCE((SELECT cnt FROM closed), 0)) AS pending,
      CASE WHEN COALESCE((SELECT cnt FROM raised), 0) = 0 THEN NULL
           ELSE ROUND(100.0 * COALESCE((SELECT cnt FROM closed), 0) / COALESCE((SELECT cnt FROM raised), 0), 2)
      END AS closure_percent
    ON CONFLICT (year, month) DO UPDATE
      SET cards_raised    = EXCLUDED.cards_raised,
          cards_closed    = EXCLUDED.cards_closed,
          cards_opened    = EXCLUDED.cards_opened,
          cards_escalated = EXCLUDED.cards_escalated,
          pending         = EXCLUDED.pending,
          closure_percent = EXCLUDED.closure_percent;

    m := (m + interval '1 month')::date;
  END LOOP;
END;
$$;


-- Creates psccard_escalation_history (if missing) and a trigger that automatically
-- records a history row whenever psccard.escalation_id is changed.
--
-- Run this on your database (psql -f sql/create_psccard_escalation_history_and_trigger.sql)

-- 1) create history table (safe-if-not-exists)
CREATE TABLE IF NOT EXISTS psccard_escalation_history (
  id SERIAL PRIMARY KEY,
  psccard_id INTEGER NOT NULL REFERENCES psccard(id) ON DELETE CASCADE,
  from_escalation_id INTEGER REFERENCES escalation(id),
  to_escalation_id INTEGER REFERENCES escalation(id),
  changed_by INTEGER NULL,            -- will be NULL if not provided
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes to speed queries used by reports
CREATE INDEX IF NOT EXISTS idx_psceh_psccard_changed_at ON psccard_escalation_history (psccard_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_psceh_to_escalation_changed_at ON psccard_escalation_history (to_escalation_id, changed_at);

-- 2) Trigger function: insert a history row automatically when escalation_id changes
CREATE OR REPLACE FUNCTION trg_psccard_escalation_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only insert when escalation_id actually changes (including NULL -> value, value -> NULL)
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.escalation_id IS DISTINCT FROM NEW.escalation_id) THEN
      INSERT INTO psccard_escalation_history (
        psccard_id,
        from_escalation_id,
        to_escalation_id,
        changed_by,
        changed_at
      ) VALUES (
        NEW.id,
        OLD.escalation_id,
        NEW.escalation_id,
        NULL,              -- changed_by left NULL because escalation changes are automatic/time-based
        CURRENT_TIMESTAMP
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Create trigger on psccard to call the function BEFORE UPDATE
DROP TRIGGER IF EXISTS psccard_escalation_history_trg ON psccard;

CREATE TRIGGER psccard_escalation_history_trg
  BEFORE UPDATE ON psccard
  FOR EACH ROW
  WHEN (OLD.escalation_id IS DISTINCT FROM NEW.escalation_id)
  EXECUTE FUNCTION trg_psccard_escalation_history();

