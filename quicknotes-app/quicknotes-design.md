# QuickNotes Database Design

## Entities and columns

### `users`
- `id INTEGER PRIMARY KEY`: unique identifier for each user.
- `name TEXT NOT NULL`: user's name.
- `email TEXT NOT NULL UNIQUE`: required email address; no two users can share one.

### `notes`
- `id INTEGER PRIMARY KEY`: unique identifier for each note.
- `user_id INTEGER NOT NULL`: foreign key to `users.id`.
- `title TEXT NOT NULL`: note title.
- `text TEXT NOT NULL`: note content.
- `created_at TEXT NOT NULL`: date and time the note was created. SQLite's `CURRENT_TIMESTAMP` supplies a default.

### `tags`
- `id INTEGER PRIMARY KEY`: unique identifier for each tag.
- `name TEXT NOT NULL UNIQUE`: tag name, such as `urgent` or `school`.

### `note_tags`
- `note_id INTEGER NOT NULL`: foreign key to `notes.id`.
- `tag_id INTEGER NOT NULL`: foreign key to `tags.id`.
- `PRIMARY KEY (note_id, tag_id)`: composite primary key prevents duplicate links.

## Relationships

- One user can own many notes. Each note belongs to one user through `notes.user_id`.
- Notes and tags have a many-to-many relationship: a note can have many tags, and a tag can be attached to many notes.
- `note_tags` is the join table that implements the many-to-many relationship.
- `ON DELETE CASCADE` removes a user's notes when that user is deleted, and removes note-tag links when a note or tag is deleted.

## Required queries

The SQL file includes:
1. All of Amina's notes, ordered newest first.
2. All notes tagged `urgent`, using two JOINs.
3. The number of notes each user has, using `LEFT JOIN`, `COUNT`, and `GROUP BY`.

## Index choices

- `users.email`: the `UNIQUE` constraint creates an index, helping enforce uniqueness and find users by email.
- `tags.name`: the `UNIQUE` constraint creates an index, helping enforce unique tag names and find tags by name.
- `notes(user_id, created_at DESC)`: helps retrieve a user's notes in newest-first order.
- `note_tags(tag_id)`: helps find notes associated with a given tag. The composite primary key `(note_id, tag_id)` already supports searches starting with `note_id`.

Indexes speed up relevant reads but use extra storage and can add overhead to inserts, updates, and deletes, so they should target common queries.

## Run and verify

1. Open https://sqliteonline.com/.
2. Select SQLite and paste/run `quicknotes.sql`.
3. Run the three SELECT queries and inspect the results.
4. The sample data should show two notes for Amina, two notes tagged `urgent`, and note counts of 2 for Amina, 1 for Brian, and 1 for Carol.
