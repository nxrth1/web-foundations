-- QuickNotes Database Lab
-- SQLite-compatible: run this complete script in sqliteonline.com.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS note_tags;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS users;

-- 1. Users
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- 2. Notes: each note belongs to one user.
CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Tags: each tag name can exist only once.
CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- 4. Join table: notes and tags have a many-to-many relationship.
CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Sample data
INSERT INTO users (id, name, email) VALUES
    (1, 'Amina', 'amina@example.com'),
    (2, 'Brian', 'brian@example.com'),
    (3, 'Carol', 'carol@example.com');

INSERT INTO notes (id, user_id, title, text, created_at) VALUES
    (1, 1, 'Assignment deadline', 'Submit the database lab by Friday.', '2026-10-13 09:00:00'),
    (2, 1, 'Study plan', 'Review SQL joins and indexes.', '2026-10-12 18:30:00'),
    (3, 2, 'Project meeting', 'Meet the team at 10 AM.', '2026-10-13 08:15:00'),
    (4, 3, 'Shopping list', 'Buy notebooks and pens.', '2026-10-11 14:00:00');

INSERT INTO tags (id, name) VALUES
    (1, 'urgent'),
    (2, 'school'),
    (3, 'personal');

INSERT INTO note_tags (note_id, tag_id) VALUES
    (1, 1),
    (1, 2),
    (2, 2),
    (3, 1),
    (4, 3);

-- Query 1: All of Amina's notes, newest first.
SELECT n.id, n.title, n.text, n.created_at
FROM notes AS n
JOIN users AS u ON u.id = n.user_id
WHERE u.name = 'Amina'
ORDER BY n.created_at DESC;

-- Query 2: All notes tagged "urgent" (two JOINs).
SELECT n.id, n.title, n.text, n.created_at
FROM notes AS n
JOIN note_tags AS nt ON nt.note_id = n.id
JOIN tags AS t ON t.id = nt.tag_id
WHERE t.name = 'urgent'
ORDER BY n.created_at DESC;

-- Query 3: Number of notes per user, including users with zero notes.
SELECT u.id, u.name, COUNT(n.id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.name
ORDER BY u.name;

-- Suggested indexes:
-- UNIQUE constraints already create indexes for users.email and tags.name.
-- The composite primary key on note_tags supports lookups by note_id.
-- This index helps queries that find notes for a user and sort newest first.
CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);
-- This index helps find all notes linked to a given tag.
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
