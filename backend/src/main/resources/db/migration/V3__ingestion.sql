CREATE SEQUENCE catalog_position START WITH 1000;
CREATE TABLE uploads (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    artist VARCHAR(120) NOT NULL,
    genre VARCHAR(64) NOT NULL,
    rights_note VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('RECEIVING','QUEUED','PROCESSING','READY','FAILED','DELETING')),
    error VARCHAR(300),
    source_deleted BOOLEAN NOT NULL DEFAULT false,
    output_deleted BOOLEAN NOT NULL DEFAULT false,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX uploads_owner_idx ON uploads(account_id, created_at DESC);
CREATE INDEX uploads_queue_idx ON uploads(status, updated_at);
