-- =====================================================================
-- C1 PROPOSED EXTENSION — token storage for refresh / logout / password reset
--
-- STATUS: NOT in the approved master schema (schema_relational.dbml has
-- 22 entities and neither of these tables). Get team sign-off before
-- using it, then add both tables to the DBML.
--
-- Why it is needed: Member 1's plan includes POST /api/auth/refresh,
-- /logout, /forgot-password and /reset-password. Revocable refresh tokens
-- and single-use reset tokens need server-side state; stateless JWT alone
-- cannot revoke or expire-on-use.
--
-- Security rule: store ONLY the hex SHA-256 of a token, never the raw
-- token. Look up with token_hash = encode(sha256(raw), 'hex').
--
-- Run AFTER schema.sql:  psql -d railway -v ON_ERROR_STOP=1 -f schema_auth_tokens.sql
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS refresh_tokens        CASCADE;

CREATE TABLE refresh_tokens (
    token_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER   NOT NULL,
    token_hash  CHAR(64)  NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    expires_at  TIMESTAMP NOT NULL,
    revoked_at  TIMESTAMP,          -- set on logout or rotation
    replaced_by INTEGER,            -- next token in the rotation chain (reuse detection)

    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_replaced_by
        FOREIGN KEY (replaced_by) REFERENCES refresh_tokens (token_id) ON DELETE SET NULL,
    CONSTRAINT ck_refresh_hash_hex CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_refresh_expiry   CHECK (expires_at > created_at)
);
CREATE INDEX ix_refresh_user ON refresh_tokens (user_id);

CREATE TABLE password_reset_tokens (
    reset_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER   NOT NULL,
    token_hash CHAR(64)  NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    expires_at TIMESTAMP NOT NULL,
    used_at    TIMESTAMP,           -- single use: set when consumed

    CONSTRAINT uq_reset_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_reset_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT ck_reset_hash_hex CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_reset_expiry   CHECK (expires_at > created_at)
);
CREATE INDEX ix_reset_user ON password_reset_tokens (user_id);

COMMIT;
