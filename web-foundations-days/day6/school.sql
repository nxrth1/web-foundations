-- Day 6 Assignment: A School Database
-- SQLite-compatible SQL
-- Run this entire file in https://sqliteonline.com/

PRAGMA foreign_keys = ON;

-- This is a reset-and-seed script: running it deletes and recreates these tables.
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- 1. Create the tables.
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL UNIQUE,
    teacher TEXT NOT NULL
);

CREATE TABLE enrolments (
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

-- The composite primary key in enrolments prevents a student from
-- enrolling in the same course more than once.

-- 2. Insert sample data: 4 students, 3 courses, and 5 enrolments.
-- A NULL grade means the course has not been graded yet.
-- Diana has no enrolments so Query 4 returns a result.
INSERT INTO students (student_id, name, email) VALUES
    (1, 'Amina Otieno', 'amina@example.com'),
    (2, 'Brian Kamau', 'brian@example.com'),
    (3, 'Carol Wanjiku', 'carol@example.com'),
    (4, 'Diana Mwangi', 'diana@example.com');

INSERT INTO courses (course_id, course_name, teacher) VALUES
    (1, 'Database Systems', 'Mr Ochieng'),
    (2, 'Web Development', 'Ms Njeri'),
    (3, 'Data Analytics', 'Mrs Achieng');

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, NULL),
    (1, 2, 'B'),
    (2, 1, 'B'),
    (2, 3, 'A'),
    (3, 2, 'C');

-- 3. Query 1: All courses taken by one student (searched by name).
-- Change 'Amina Otieno' to another student name if desired.
SELECT s.name AS student_name, c.course_name, e.grade
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.name = 'Amina Otieno'
ORDER BY c.course_name;

-- 4. Query 2: All students enrolled in one course.
-- Change 'Database Systems' to another course if desired.
SELECT c.course_name, s.name AS student_name, e.grade
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.course_name = 'Database Systems'
ORDER BY s.name;

-- 5. Query 3: Number of students enrolled per course.
-- LEFT JOIN includes courses with zero enrolments.
SELECT c.course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_name
ORDER BY c.course_name;

-- 6. Query 4: Students who have no enrolments.
SELECT s.student_id, s.name, s.email
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.student_id IS NULL
ORDER BY s.name;

-- 7. Query 5: Record Amina Otieno's grade for Database Systems.
UPDATE enrolments
SET grade = 'A'
WHERE student_id = (
    SELECT student_id FROM students WHERE name = 'Amina Otieno'
)
AND course_id = (
    SELECT course_id FROM courses WHERE course_name = 'Database Systems'
);

-- Optional verification of the updated grade.
SELECT s.name AS student_name, c.course_name, e.grade
FROM enrolments AS e
JOIN students AS s ON s.student_id = e.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.name = 'Amina Otieno'
  AND c.course_name = 'Database Systems';

-- The composite primary key supports student lookups; this index supports
-- course lookups, including the course-count query. UNIQUE(email) is indexed.
CREATE INDEX idx_enrolments_course ON enrolments(course_id);
