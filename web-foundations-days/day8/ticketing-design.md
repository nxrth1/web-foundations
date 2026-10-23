# TicketHub System Design

## 1. Requirements

### Functional requirements

- Visitors can browse and search events and view event details, prices, and seat availability.
- Registered users can select seats, place a 10-minute hold, pay, and view their orders and tickets.
- A user can only complete payment for seats held by their current, unexpired order.
- A paid ticket is tied to one seat at one event; a seat cannot be sold twice.
- Users can see whether a seat is available, temporarily held, or sold.

### Non-functional requirements

- **Speed:** Normal-day pages should load in under one second. Target a p95 API response under 300 ms for cached reads and under 500 ms for uncached reads, excluding payment-provider time.
- **Correctness:** Seat assignment and order state must be durable and consistent. The primary database, not a cache or client, is authoritative for availability and sales.
- **Fairness:** At high-demand on-sales, use a FIFO waiting room and rate limits to admit buyers at a controlled rate. Give each admitted visitor a signed queue token and a short checkout window; do not let repeated refreshes or scripted retries jump the line. State the policy before the sale and apply it consistently.
- **Availability:** Browsing may continue from cached event data during a database slowdown, but seat holds and payment confirmation must fail clearly rather than claim an uncommitted seat.
- **Security:** Authenticate checkout, validate ownership of holds and orders, protect payment operations with idempotency keys, and never store raw card details.

## 2. Traffic and capacity estimates

### Assumptions

- There are 86,400 seconds in a day and 600 seconds in the first 10 minutes of a sale. The 100,000-second divisor sometimes used for a rough estimate is not the length of a day; using the actual day gives a slightly higher normal-day rate.
- A normal-day visitor loads 10 pages, and each page load is counted as one page request. Static assets and API calls made by a page are not included in that request count.
- The 200,000 people attempting to buy during the sale are treated as 200,000 distinct visitors during those 10 minutes. Each makes about 10 requests across browsing and checkout. Their arrival pattern may be much burstier than the 10-minute average.
- Ticket sales per day are not necessarily the same as distinct orders, since one order could contain multiple tickets.

### Normal day

- Page views: `50,000 visitors × 10 pages = 500,000 page views/day`
- Average page requests: `500,000 ÷ 86,400 ≈ 5.8 requests/second`
- Rounded rough estimate: about 5–6 requests/second; this is small compared with the on-sale burst.
- Average ticket sales: `5,000 ÷ 86,400 ≈ 0.058 tickets/second` (about one ticket every 17 seconds)
- Registered users: 2 million; this does not imply all users are active on the same day.

### Popular concert on-sale

- Requests: `200,000 people × 10 requests = 2,000,000 requests`; `2,000,000 ÷ 600 seconds ≈ 3,333 requests/second` averaged across the 10-minute sale.
- Supply: 20,000 seats, so at most `20,000 ÷ 200,000 = 10%` of those visitors can get one seat if each buys one.
- For rough scale, the sale's average request rate is about `3,333 ÷ 5.8 ≈ 575` times the normal page-request rate (roughly 600 times, or nearly 700 using the rounded 5 requests/second baseline). This is not a perfectly like-for-like comparison because the normal estimate excludes API calls and static assets while the sale estimate counts each visitor's full request journey. Arrivals can cluster in the first seconds, so 3,333 requests/second is an average, not a safe peak capacity target.
- At most 20,000 one-seat orders can succeed; the remaining 180,000 visitors need a prompt, clear unavailable/sold-out response. Requests after sellout should not keep contending for inventory.

Capacity should be tested against arrival bursts above the 10-minute average. The FIFO waiting room controls the admitted request rate, while the inventory transaction handles contention correctly even if demand exceeds the target rate.

## 3. API design

All endpoints use HTTPS. Checkout endpoints require authentication. Mutating requests accept an idempotency key so retries do not create duplicate orders or charges.

| Method and endpoint | Purpose |
|---|---|
| `GET /events?search=&city=&page=` | Search and browse public event summaries. |
| `GET /events/{eventId}` | View event details, venue, sale status, and price information. |
| `GET /events/{eventId}/seats` | View a seat map and availability snapshot; this is advisory and may be briefly stale. |
| `POST /holds` | Request a hold with `{ "eventId": 7, "seatIds": [101, 102] }`; returns a hold ID and expiry time, or `409 Conflict` if any requested seat cannot be acquired. |
| `POST /orders` | Pay for the authenticated user's unexpired hold with `{ "holdId": 55, "paymentToken": "..." }`; returns created/pending or a clear failure. |
| `GET /me/orders` | List the authenticated user's orders and their states. |
| `GET /me/tickets` | Retrieve tickets only when their orders belong to the authenticated user and are paid. |

The seat map is not a promise that a seat can still be bought. The hold endpoint performs the authoritative availability check atomically. Payment callbacks are verified and processed idempotently.

## 4. Data model

The primary relational database stores transactional inventory and orders. Primary and foreign keys enforce identity and relationships.

### `users`

- `user_id` — primary key.
- `name` — display name.
- `email` — required, unique.
- `password_hash` — password hash; never store a plaintext password.
- `created_at` — account creation time.

### `events`

- `event_id` — primary key.
- `title`, `venue`, `starts_at` — event details.
- `on_sale_at` — scheduled sale start.
- `status` — for example `scheduled`, `on_sale`, `sold_out`, or `cancelled`.

### `orders`

- `order_id` — primary key.
- `user_id` — required foreign key to `users`.
- `event_id` — required foreign key to `events`.
- `status` — `pending_payment`, `paid`, `expired`, `cancelled`, or `payment_failed`.
- `idempotency_key` — required key scoped to the user; unique with `user_id`.
- `total`, `currency` — amount and currency fixed when the order is created.
- `created_at`, `hold_expires_at` — order creation and hold deadline.
- `payment_reference` — nullable, unique provider reference; do not store card credentials.

### `seats`

PostgreSQL-style definition (the other tables are defined above):

```sql
CREATE TABLE seats (
    seat_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id        BIGINT NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
    section         TEXT NOT NULL,
    row_label       TEXT NOT NULL,
    seat_number     TEXT NOT NULL,
    price           NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'held', 'sold')),
    hold_id         BIGINT REFERENCES orders(order_id) ON DELETE RESTRICT,
    hold_expires_at TIMESTAMPTZ,
    CONSTRAINT seats_event_location_unique
        UNIQUE (event_id, section, row_label, seat_number),
    CONSTRAINT seats_state_consistent CHECK (
        (status = 'available' AND hold_id IS NULL AND hold_expires_at IS NULL)
        OR (status = 'held' AND hold_id IS NOT NULL AND hold_expires_at IS NOT NULL)
        OR (status = 'sold' AND hold_id IS NOT NULL AND hold_expires_at IS NULL)
    )
);
```

The unique event/location constraint prevents duplicate seat definitions. The state check makes invalid combinations (such as an available seat with an order, or a sold seat with a hold expiry) impossible to commit.

`hold_id` points to the pending order that currently owns a hold, and remains linked to that order when the seat becomes sold. If an unpaid hold expires, the next successful hold clears the previous link and replaces it. The hold lasts 10 minutes.

### `order_seats`

```sql
CREATE TABLE order_seats (
    order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE RESTRICT,
    seat_id  BIGINT NOT NULL REFERENCES seats(seat_id) ON DELETE RESTRICT,
    PRIMARY KEY (order_id, seat_id),
    CONSTRAINT one_order_per_seat UNIQUE (seat_id)
);
```

This records the seats included in paid orders. The unique `seat_id` constraint is a second safeguard against attaching a seat to two orders; the seat row's conditional state transition remains the first line of defense.

### Relationships and indexes

- One user can have many orders; each order belongs to one user.
- One event has many seats; each seat belongs to one event.
- One order can reserve or purchase multiple seats; each seat can be linked to at most one current hold/order through `seats.hold_id`, and at most one paid order through the unique `order_seats.seat_id`.
- Index `seats(event_id, status)` for seat-map availability queries and `orders(user_id, created_at)` for order history.
- These status constraints prevent seat rows from representing contradictory inventory states.

## 5. Architecture and double-booking prevention

```text
 Buyers
   |
   v
+--------------------------+
| CDN: event pages, images,|
| CSS, and JavaScript      |
+------------+-------------+
             |
             v
+------------+-------------+
| FIFO waiting room /      |
| rate limiter             |
+------------+-------------+
             |
             v
+------------+-------------+       +----------------------+
| Load balancer            |------>| Auto-scaled,         |
+--------------------------+       | stateless app servers|
                                   +---+--------+---------+
                                       |        |
                              browse  |        | holds/orders
                              /cache   |        |
                                       v        v
                              +--------+--+  +--+------------------+
                              | Redis     |  | Primary relational  |
                              | cache     |  | DB: seats, orders   |
                              +-----------+  +--+------------------+
                                               |       |        |
                           tokenized payment   |       |        +-- replication --> [Read replicas]
                           + verified callback |       |                          (browse/search)
                                               v       +----> [Queue] --> [Workers]
                                    [Payment provider]          ticket emails/PDFs
```

- **CDN/static cache:** Serves event pages and static assets close to visitors, reducing repeated origin work; it never decides whether a seat is available.
- **Waiting room/rate limiter:** Preserves the published FIFO arrival order, admits buyers at a tested rate, and protects the checkout path from overload and abusive retries.
- **Load balancer:** Spreads admitted requests across healthy application servers.
- **Auto-scaled stateless app servers:** Validate identity, queue tokens, request data, and order ownership, and can scale horizontally without holding inventory state in process memory. Add capacity before known sales and scale down afterwards.
- **Redis cache:** Caches event details and seat-map snapshots for a short TTL to absorb read traffic. After a hold or sale commits, the app invalidates that event's seat-map cache; the TTL bounds staleness if invalidation is delayed or fails. A cached free seat is never approval to buy.
- **Relational database primary:** Is the single authority for seat holds and orders; transactions and constraints serialize competing claims to the same seat.
- **Read replica:** Serves browse and event-detail queries to reduce read load on the primary; it is not used to approve a hold or payment because replication may lag, and the primary replicates changes to it.
- **Payment provider:** Securely processes payments; provider callbacks are verified and deduplicated before an order is marked paid.
- **Queue and workers:** Generate and email ticket PDFs after payment so those tasks do not slow checkout.

### Hold and purchase flow

1. A visitor browses event and seat-map data. Cached seat availability is explicitly a snapshot, not a reservation.
2. The waiting room admits the visitor and issues a short-lived signed token. The user authenticates before requesting a hold.
3. In a single database transaction, the application creates a pending order and locks requested rows in `seat_id` order. It checks that every ID belongs to the event, then executes a conditional update such as:

   ```sql
   BEGIN;

   -- The pending order is created in this transaction before claiming seats.
   SELECT seat_id
   FROM seats
   WHERE event_id = 7 AND seat_id IN (101, 102)
   ORDER BY seat_id
   FOR UPDATE;

   UPDATE seats
   SET status = 'held',
       hold_id = 55,
       hold_expires_at = NOW() + INTERVAL '10 minutes'
   WHERE seat_id IN (101, 102)
     AND event_id = 7
     AND (
         status = 'available'
         OR (status = 'held' AND hold_expires_at < NOW())
     )
   RETURNING seat_id;

   -- If fewer than 2 rows are returned: ROLLBACK and return 409 Conflict.
   -- Otherwise: COMMIT and return 201 Created.
   ```

   The application compares the returned row count with the number of requested seats. If any seat is missing, unavailable, or the count is short, it rolls back the entire transaction and returns `409 Conflict`; otherwise it commits the pending order and all seat holds together. This prevents a partial multi-seat hold.
4. Concurrent buyers for the same seat contend on the same database row. One transaction obtains the row lock first; the other waits. After the first transaction commits, the waiting transaction rechecks the `WHERE` condition against the current row and cannot claim the now-held seat. Only one update can return that seat ID. The conditional update is the atomic check-and-change; row locks and the transaction also make multi-seat acquisition all-or-nothing.
5. A unique `(user_id, idempotency_key)` on orders makes retries return the original order instead of creating another. A seat's single `hold_id`, allowed-status transition, and transaction prevent two live holds from owning it; `UNIQUE (seat_id)` in `order_seats` prevents two paid orders from recording the same seat.
6. The buyer pays before the 10-minute `hold_expires_at`. The app sends an idempotent payment request to the provider. After success, a transaction rechecks that the order is still pending and its seats are still held by that order; it writes `order_seats` and marks the order paid and seats sold together. A verified provider callback uses the same idempotent transition. Ticket PDFs and emails are queued after commit.
7. If the hold expires before payment is confirmed, the seat can be claimed by another order. A late payment success must not sell an already reassigned seat: void/refund that payment and notify the buyer. A cleanup worker can mark expired pending orders, while each hold request also checks expiry so correctness does not depend on cleanup timing.

The database transaction is the final safeguard; queue tokens, caches, and UI messages improve fairness and experience but are not substitutes for atomic inventory updates. Sorting the requested seat IDs before locking gives competing multi-seat requests a consistent lock order and reduces deadlock risk. Expired holds become reusable when the conditional update encounters them; cleanup is not required for correctness. Cache invalidation happens after the database commit, so a delayed cache update can affect only the advisory map, never the result of a hold.

## 6. Trade-offs

- **Fairness vs. simplicity:** A FIFO waiting room honors arrival order and protects the system from refreshers and bots, but adds queue infrastructure and operational complexity. Open access is simpler, but the fastest connections and scripts may dominate and the spike can overload the system.
- **Strict relational inventory vs. eventually consistent seat availability:** Transactions and row contention protect correctness, but the primary can become a bottleneck for a very popular event. A read replica and cached seat map improve browsing throughput, but may show a seat as available just after it was held; checkout must always validate against the primary.
- **Short seat holds vs. longer checkout windows:** Short holds return unsold inventory sooner and reduce the chance of abandoned carts blocking buyers, but leave less time for a slow payment flow. Longer holds improve buyer convenience but keep scarce seats unavailable for longer.
- **All-or-nothing multi-seat holds vs. partial success:** Rolling back when any selected seat is unavailable avoids surprising partial orders, but can frustrate a buyer whose other selected seats were available and requires them to select again.
