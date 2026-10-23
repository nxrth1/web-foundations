# TicketHub System Design

## 1. Requirements

### Functional requirements

- Visitors can browse and search events and view event details, prices, and seat availability.
- Registered users can select seats, place a time-limited hold, pay, and view their orders and tickets.
- A user can only complete payment for seats held by their current, unexpired order.
- A paid ticket is tied to one seat at one event; a seat cannot be sold twice.
- Users can see whether a seat is available, temporarily held, or sold.

### Non-functional requirements

- **Speed:** Normal event browsing should be fast; target a p95 API response under 300 ms for cached reads and under 500 ms for uncached reads, excluding payment-provider time.
- **Correctness:** Seat assignment and order state must be durable and consistent. The primary database, not a cache or client, is authoritative for availability and sales.
- **Fairness:** At high-demand on-sales, use a waiting room and rate limits to admit buyers at a controlled rate. Give each admitted visitor a signed queue token and a short checkout window; do not let repeated refreshes or scripted retries jump the line. State the policy before the sale and apply it consistently.
- **Availability:** Browsing may continue from cached event data during a database slowdown, but seat holds and payment confirmation must fail clearly rather than claim an uncommitted seat.
- **Security:** Authenticate checkout, validate ownership of holds and orders, protect payment operations with idempotency keys, and never store raw card details.

## 2. Traffic and capacity estimates

### Assumptions

- There are 86,400 seconds in a day and 600 seconds in the first 10 minutes of a sale.
- A normal-day visitor loads 10 pages, and each page load is counted as one page request. Static assets and API calls made by a page are not included in that request count.
- The 200,000 people attempting to buy during the sale are treated as 200,000 distinct visitors during those 10 minutes. Their arrival pattern may be much burstier than the 10-minute average.
- Ticket sales per day are not necessarily the same as distinct orders, since one order could contain multiple tickets.

### Normal day

- Page views: `50,000 visitors × 10 pages = 500,000 page views/day`
- Average page requests: `500,000 ÷ 86,400 ≈ 5.8 requests/second`
- Average ticket sales: `5,000 ÷ 86,400 ≈ 0.058 tickets/second` (about one ticket every 17 seconds)
- Registered users: 2 million; this does not imply all users are active on the same day.

### Popular concert on-sale

- Attempting visitors: `200,000 people ÷ 600 seconds ≈ 333 people/second` on average over the first 10 minutes.
- Supply: 20,000 seats, so at most `20,000 ÷ 200,000 = 10%` of those visitors can get one seat if each buys one.
- The request rate can exceed 333 requests/second because a visitor may browse, refresh, select seats, retry, and check out. Moreover, arrivals can cluster in the first seconds, so 333/second is a 10-minute average, not a safe peak capacity target.
- If each arriving sale visitor makes just one initial event-page request, the sale averages about `333 ÷ 5.8 ≈ 57` times the normal page-request rate, before counting other calls in a purchase journey. The sale also concentrates writes on one event's inventory, unlike the low normal ticket-sales average.

Capacity should be tested against arrival bursts above the 10-minute average. A waiting room controls the admitted request rate, while the inventory transaction handles contention correctly even if demand exceeds the target rate.

## 3. API design

All endpoints use HTTPS. Checkout endpoints require authentication. Mutating requests accept an idempotency key so retries do not create duplicate orders or charges.

| Method and endpoint | Purpose |
|---|---|
| `GET /events?query=&date=&page=` | Search and browse public event summaries. |
| `GET /events/{eventId}` | View event details, venue, sale status, and price information. |
| `GET /events/{eventId}/seats` | View a seat map and availability snapshot; this is advisory and may be briefly stale. |
| `POST /events/{eventId}/holds` | Request a hold for selected seat IDs; returns an order/hold ID, expiry time, and seats successfully held, or a conflict if any requested seat cannot be acquired. |
| `POST /orders/{orderId}/payment` | Pay for the authenticated user's unexpired held seats using a payment token from the payment provider; returns pending, paid, or a clear failure. |
| `GET /me/orders` | List the authenticated user's orders and their states. |
| `GET /me/orders/{orderId}/tickets` | Retrieve tickets only when the order belongs to the user and is paid. |

The seat map is not a promise that a seat can still be bought. The hold endpoint performs the authoritative availability check atomically. Payment callbacks are verified and processed idempotently.

## 4. Data model

The primary relational database stores transactional inventory and orders. Primary and foreign keys enforce identity and relationships.

### `users`

- `user_id` — primary key.
- `email` — required, unique.
- `created_at` — account creation time.

### `events`

- `event_id` — primary key.
- `title`, `venue`, `starts_at` — event details.
- `on_sale_at` — scheduled sale start.
- `status` — for example `scheduled`, `on_sale`, `sold_out`, or `cancelled`.

### `orders`

- `order_id` — primary key.
- `user_id` — required foreign key to `users`.
- `status` — `pending_payment`, `paid`, `expired`, `cancelled`, or `payment_failed`.
- `idempotency_key` — required key scoped to the user; unique with `user_id`.
- `total_amount`, `currency` — amount and currency fixed when the order is created.
- `created_at`, `hold_expires_at` — order creation and hold deadline.
- `payment_reference` — nullable, unique provider reference; do not store card credentials.

### `seats`

- `seat_id` — primary key.
- `event_id` — required foreign key to `events`.
- `section`, `row_label`, `seat_number` — seat location.
- `price` — price for the event's seat.
- `status` — `available`, `held`, or `sold`.
- `order_id` — nullable foreign key to `orders`, set for a held or sold seat.
- `hold_expires_at` — nullable deadline for a hold.
- `UNIQUE (event_id, section, row_label, seat_number)` prevents duplicate seat definitions for an event.

### Relationships and indexes

- One user can have many orders; each order belongs to one user.
- One event has many seats; each seat belongs to one event.
- One order can reserve or purchase multiple seats; each seat can be linked to at most one current order through its single `order_id`.
- Index `seats(event_id, status)` for seat-map availability queries and `orders(user_id, created_at)` for order history.
- A consistency constraint should require `order_id` and `hold_expires_at` for `held` seats, and `order_id` with no expiry for `sold` seats; `available` seats have no order or expiry.

## 5. Architecture and double-booking prevention

```text
 Buyers
   |
   v
+---------------------+        +----------------------+
| CDN / static cache  |------->| Waiting room /      |
| event pages/assets  |        | rate limiter         |
+---------------------+        +----------+-----------+
                                          |
                                          v
                               +----------+-----------+
                               | Load balancer / API  |
                               +----------+-----------+
                                          |
                                          v
                               +----------+-----------+
                               | Stateless app        |
                               | servers              |
                               +---+--------------+---+
                                   |              |
                          browse/read             | atomic hold,
                                   |              | order, ticket
                                   v              v
                        +----------+------+  +----+----------------+
                        | Read replica    |<--| Relational database|
                        | browse queries  |   | primary inventory  |
                        +-----------------+   +---------+----------+
                                                        |
                                                 payment request /
                                                 verified callback
                                                        |
                                                        v
                                             +----------+-----------+
                                             | Payment provider     |
                                             +----------------------+
```

- **CDN/static cache:** Serves event pages and static assets close to visitors, reducing repeated origin work; it never decides whether a seat is available.
- **Waiting room/rate limiter:** Smooths a sharp arrival spike, applies the published admission policy, and protects the checkout path from overload and abusive retries.
- **Load balancer:** Spreads admitted requests across healthy application servers.
- **Stateless app servers:** Validate identity, queue tokens, request data, and order ownership, and can scale horizontally without holding inventory state in process memory.
- **Relational database primary:** Is the single authority for seat holds and orders; transactions and constraints serialize competing claims to the same seat.
- **Read replica:** Serves browse and event-detail queries to reduce read load on the primary; it is not used to approve a hold or payment because replication may lag, and the primary replicates changes to it.
- **Payment provider:** Securely processes payments; provider callbacks are verified and deduplicated before an order is marked paid.

### Hold and purchase flow

1. A visitor browses event and seat-map data. Cached seat availability is explicitly a snapshot, not a reservation.
2. The waiting room admits the visitor and issues a short-lived signed token. The user authenticates before requesting a hold.
3. In a single database transaction, the application creates a pending order and conditionally claims every requested seat. For each seat, it updates the row only if it is `available` or its previous hold has expired. The application checks that every requested row was updated; if any claim fails, it rolls back the whole transaction so the buyer does not get a partial set unexpectedly.
4. Concurrent buyers for the same seat contend on the same database row. Row-level locking/conditional update ensures only one transaction can change it from available (or expired hold) to held. The transaction commits the order, seat links, and hold expiry together.
5. A unique `(user_id, idempotency_key)` on orders makes retries return the original order instead of creating another. The seat row's single `order_id`, allowed-status transition, and transaction prevent two live orders from owning it.
6. The buyer pays before `hold_expires_at`. The app sends an idempotent payment request to the provider. After success, a transaction rechecks that the order is still pending and its seats are still held by that order; it marks the order paid and seats sold together. A verified provider callback uses the same idempotent transition.
7. If the hold expires before payment is confirmed, the seat can be claimed by another order. A late payment success must not sell an already reassigned seat: void/refund that payment and notify the buyer. A cleanup worker can mark expired pending orders, while each hold request also checks expiry so correctness does not depend on cleanup timing.

The database transaction is the final safeguard; queue tokens, caches, and UI messages improve fairness and experience but are not substitutes for atomic inventory updates.

## 6. Trade-offs

- **Waiting room vs. open access:** Admission control reduces overload and gives a consistent, published queue policy, but visitors may wait and a queue adds infrastructure and operational complexity. Randomized admission before the sale can be fairer than letting the fastest connection win, but the policy must be explained clearly.
- **Strict relational inventory vs. eventually consistent seat availability:** Transactions and row contention protect correctness, but the primary can become a bottleneck for a very popular event. A read replica and cached seat map improve browsing throughput, but may show a seat as available just after it was held; checkout must always validate against the primary.
- **Short seat holds vs. longer checkout windows:** Short holds return unsold inventory sooner and reduce the chance of abandoned carts blocking buyers, but leave less time for a slow payment flow. Longer holds improve buyer convenience but keep scarce seats unavailable for longer.
- **All-or-nothing multi-seat holds vs. partial success:** Rolling back when any selected seat is unavailable avoids surprising partial orders, but can frustrate a buyer whose other selected seats were available and requires them to select again.
