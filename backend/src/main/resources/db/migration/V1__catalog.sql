CREATE TABLE tracks (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    genre VARCHAR(64) NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    audio_key VARCHAR(255) NOT NULL,
    artwork VARCHAR(32) NOT NULL,
    position INTEGER NOT NULL UNIQUE
);

INSERT INTO tracks VALUES
('first-light', 'First Light', 'Unison Lab', 'Ambient', 60, 'first-light.wav', 'sunrise', 1),
('slow-orbit', 'Slow Orbit', 'Unison Lab', 'Electronic', 60, 'slow-orbit.wav', 'orbit', 2),
('tidal', 'Tidal', 'Unison Lab', 'Downtempo', 60, 'tidal.wav', 'tide', 3);
