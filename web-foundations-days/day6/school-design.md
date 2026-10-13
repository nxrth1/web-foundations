# School Database Design

## 1. Tables

### `students`
Stores each student's details.

- `student_id`: integer primary key; uniquely identifies each student.
- `name`: required student name.
- `email`: required email address; `UNIQUE` prevents two students from using the same email.

### `courses`
Stores the courses offered by the school.

- `course_id`: integer primary key; uniquely identifies each course.
- `course_name`: required course name. It is also unique in this sample design so the same course is not entered twice.
- `teacher`: required name of the course's teacher.

### `enrolments`
Records which students take which courses and the grade each student receives.

- `student_id`: required foreign key referencing `students(student_id)`.
- `course_id`: required foreign key referencing `courses(course_id)`.
- `grade`: grade for the enrolment; `NULL` means the course has not been graded yet.
- `PRIMARY KEY (student_id, course_id)`: a composite primary key that prevents the same student from enrolling in the same course more than once.
- Both foreign keys use `ON DELETE CASCADE`, so deleting a student or course also removes its enrolment records.

## 2. Relationships

- **Students to enrolments: one-to-many.** One student may have many enrolment records, but each enrolment belongs to one student.
- **Courses to enrolments: one-to-many.** One course may have many enrolment records, but each enrolment refers to one course.
- **Students to courses: many-to-many.** A student can take multiple courses, and each course can have multiple students. The `enrolments` table resolves this many-to-many relationship.

## 3. Why a join table is needed

A student can take several courses, and each course can be taken by several students. Putting a single course directly in the `students` table would not support multiple courses cleanly. Repeating student details for every course would also duplicate data. The `enrolments` table stores each student-course relationship once and holds the grade for that specific enrolment.

## 4. Index

The script creates `idx_enrolments_course` on `enrolments(course_id)`. The composite primary key starts with `student_id`, so it supports student-based lookups but not course-based lookups; this additional index helps queries that find or count students by course. The unique constraint on `students.email` also creates an index in SQLite, so a separate email index is unnecessary.

## 5. SQL or NoSQL?

I would choose a **relational SQL database** for this school system. Students, courses, enrolments, and grades have clear relationships and constraints. SQL foreign keys help prevent enrolments that refer to missing students or courses, while the composite primary key prevents duplicate enrolments. JOINs and GROUP BY make it straightforward to retrieve course lists and count enrolments. A document database can be useful for flexible or nested records, but this structured, relationship-heavy system fits SQL better.

## 6. Testing

Run `school.sql` in the SQLite playground at <https://sqliteonline.com/>.

The script is a reset-and-seed script: it drops and recreates its tables, so running it deletes existing data in those tables.

Expected checks with the sample data:

- Amina Otieno is enrolled in Database Systems (initially ungraded) and Web Development (B).
- The course list includes each course's teacher.
- Database Systems has 2 students.
- Web Development has 2 students.
- Data Analytics has 1 student.
- The “students with no enrolments” query returns Diana Mwangi.
- Query 5 records Amina's Database Systems grade as `A`.
