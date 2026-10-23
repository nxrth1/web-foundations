# SnapShare Scaling Plan

## 1. Assumptions and users

- SnapShare has 10 million registered users, and 10% are active on an average day.
- Each daily active user uploads one photo and views 50 feed pages per day.
- The 2 MB photo and 50 KB thumbnail sizes are decimal units (1 MB = 1,000 KB); there is one thumbnail per photo.
- There are 86,400 seconds per day and 365 days per year. Average request rates are spread evenly across each day; peak feed traffic is five times its average.
- Storage estimates include one original and one thumbnail per upload, with no compression, deletion, or storage overhead; replicas and backups are excluded.
- A feed page view is counted as one request, regardless of how many photos it displays.

Daily active users:

`10,000,000 registered users × 10% = 1,000,000 daily active users`

## 2. Traffic and storage estimates

**Uploads**

- Daily uploads: `1,000,000 active users × 1 photo = 1,000,000 photos/day`
- Average uploads per second: `1,000,000 ÷ 86,400 ≈ 11.6 photos/second`

**Feed views**

- Daily feed views: `1,000,000 active users × 50 pages = 50,000,000 page views/day`
- Average feed views per second: `50,000,000 ÷ 86,400 ≈ 579 page views/second`
- Peak feed views per second: `579 × 5 ≈ 2,894 page views/second`

**Photo storage**

- Original photos per year: `1,000,000 × 365 = 365,000,000`
- Original storage per year: `365,000,000 × 2 MB = 730 TB`
- Thumbnail storage per year: `365,000,000 × 50 KB = 18.25 TB`
- Total new photo storage per year: `730 TB + 18.25 TB = 748.25 TB` (about 0.75 PB)

These are baseline averages and capacity estimates, not guarantees about burst traffic or actual storage growth.

## 3. Read-heavy or write-heavy?

SnapShare is **read-heavy**: the stated workload has 50 feed-page views for every photo upload, and each feed page can involve multiple photo reads. The design should scale read paths horizontally, cache frequently requested feed data and media, and serve image bytes through a CDN; writes still need a durable upload and asynchronous thumbnail path.

## 4. Photo storage

Photo files should not be stored as database blobs because large binary values increase database storage and backup costs and compete with application metadata queries for database resources. Store originals and thumbnails in object storage, and keep their keys, ownership, timestamps, and other searchable metadata in the database.

## 5. Architecture

```text
+--------+ -- API --> +----------------+ --> +-------------+ <--> +-------+
| Client |            | Load balancer  |     | App servers |      | Cache |
+---+----+            +----------------+     +------+------+
    |                                               |  \
    | authorized direct photo upload               |   +--> +-------+  replication  +-------------------+
    v                                               |        |  DB   |------------->| Database read     |
+------------------+                                |        |primary|              | replica           |
| Object storage   |<-------------------------------+        +-------+              +---------+---------+
+--------+---------+          generated thumbnail                                            |
         ^                                                                                  | read queries
         |                                                                                  +----> App servers
         |
         | media origin
    +----+----+      cached photos       +--------+
    |   CDN   |------------------------->| Client |
    +---------+                          +--------+

App servers -- thumbnail job --> +-------+ --> +------------------+
                                 | Queue |     | Thumbnail worker |
                                 +-------+     +--------+---------+
                                                       |  ^
                                      write thumbnail |  | read original
                                                       v  |
                                               +-------+--+-------+
                                               | Object storage  |
                                               +------------------+
```

## 6. What each component solves

- **CDN:** Caches and serves photo files close to viewers, reducing image latency and origin bandwidth.
- **Load balancer:** Distributes incoming API traffic across healthy app servers so one server does not become the bottleneck.
- **App servers:** Authenticate requests, apply application rules, coordinate metadata and jobs, and provide API responses without storing photo bytes themselves.
- **Cache:** Keeps frequently accessed feed data and other hot results in fast memory to reduce repeated database reads.
- **Database:** Durably stores user, photo, and feed metadata, with the primary handling writes and a read replica serving scalable read queries.
- **Object storage:** Stores original photo and thumbnail files durably and independently of the database.
- **Queue:** Buffers thumbnail-generation jobs so uploads do not have to wait for image processing and temporary worker slowdowns do not lose jobs.
- **Thumbnail worker:** Consumes queued jobs, creates smaller image variants, stores them in object storage, and updates their metadata when ready.

## 7. Photo upload flow

1. The client sends an authenticated upload request to an app server through the load balancer.
2. The app server validates the request and creates a photo metadata record with a pending-processing status.
3. The app server gives the client an authorized upload destination, and the client uploads the original photo directly to object storage.
4. After the upload succeeds, the app server confirms the object and publishes a thumbnail-generation job to the queue.
5. The thumbnail worker consumes the job, reads the original from object storage, creates a 50 KB thumbnail, and writes it back to object storage.
6. The worker updates the photo metadata to mark the thumbnail ready; the app can then include the photo in feeds, and the CDN can cache and serve the original and thumbnail.

## 8. Trade-offs

- **Direct-to-object-storage uploads vs. proxying uploads through app servers:** Direct uploads keep large file traffic off the app servers and make scaling easier, but require secure, limited-lived upload authorization and a confirmation step so metadata is not treated as complete before the file exists.
- **Asynchronous thumbnails vs. generating them during the upload request:** A queue keeps upload response times short and lets workers scale independently, but thumbnails are not immediately available and the app must handle pending or failed processing.
- **Database read replica vs. sending every read to the primary:** A replica can handle more feed reads without overwhelming write capacity, but replication lag means a newly uploaded photo may not appear immediately in every feed.
- **CDN and cache vs. always reading the origin:** Caching reduces latency and origin load, but cached content can be stale and invalidation or expiration policies add operational complexity.
