# Week 8 Reflection

The most difficult concept for me was asynchronous JavaScript. At first, I did not understand why my code printed `Promise {<pending>}` instead of the data. What helped was learning that `fetch` returns a promise for a future value, and `await` pauses only the current function while the rest of the page can keep running. Rebuilding the user directory assignment and watching its requests in the Network tab helped the idea click.

The feedback on my capstone showed me that a good architecture diagram is not enough unless it explains how the components work together. I completed the missing seat schema and made the double-booking safeguard explicit: the database atomically checks and changes a seat, and the transaction rolls back every hold if any requested seat is unavailable. I also clarified cache behavior: after a hold commits, the app invalidates the event's seat-map cache, while a short time-to-live limits staleness if invalidation is delayed. The cached map remains advisory; the primary database makes the final decision.

Next, I want to build a real backend for QuickNotes with Node.js, Express, and PostgreSQL so that my API design and data model become working code. After that, I plan to learn React.
