# Week 8 Reflection

The hardest concept for me was turning traffic estimates into design decisions, especially understanding that a daily or 10-minute average does not describe a sudden burst. I worked through it by writing down the assumptions, converting totals into per-second rates, and then tracing what happens when many users try to claim the same resource at once. The TicketHub seat-hold example helped connect database transactions and constraints to a real correctness problem.

I have not received specific written feedback on my capstone yet, so I cannot honestly attribute an improvement to reviewer feedback. On self-review, I would improve the scaling section by making the difference between average and burst traffic even clearer and explaining how I would test those assumptions. That would make the capacity plan easier to evaluate and connect it more directly to architecture choices like caching and queues.

Next, I want to learn more about CDNs: how caching rules, expiration, and invalidation work, and how to decide which content is safe to cache. I would like to apply that to a small project and measure whether it improves load time without serving stale information.
