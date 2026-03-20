-- =============================================================================
-- 016: Feedback and Feature Requests
-- =============================================================================
-- Adds transactional tables for:
--   1) User feedback + star ratings
--   2) Feature requests
--   3) Per-user upvotes for feature requests (toggle model)
-- =============================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL,
  user_name     text NOT NULL,
  is_anonymous  boolean NOT NULL DEFAULT false,
  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text text,
  comments      text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON feedback (created_at DESC);

CREATE TABLE IF NOT EXISTS feature_requests (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         uuid NOT NULL,
  requester_name  text NOT NULL,
  title           text NOT NULL,
  description     text NOT NULL,
  current_process text,
  frequency       text,
  time_spent      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at
  ON feature_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS feature_request_upvotes (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_request_id bigint NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL,
  created_at         timestamptz DEFAULT now(),
  CONSTRAINT uq_feature_request_user UNIQUE (feature_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_request_upvotes_request_id
  ON feature_request_upvotes (feature_request_id);

-- ---------- GRANTs: App service principal (hertz-leo-leadsmgmtsystem) ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON feedback TO "35332971-a7c4-4c58-ae96-f473ccb07c49";
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_requests TO "35332971-a7c4-4c58-ae96-f473ccb07c49";
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_request_upvotes TO "35332971-a7c4-4c58-ae96-f473ccb07c49";
