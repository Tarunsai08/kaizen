"""System Design roadmap.

Every article link below was taken from the live index pages of ByteByteGo (bytebytego.com/guides/<category>/,
bytebytego.com/courses/system-design-interview) and Hello Interview (hellointerview.com/learn/system-design/...)
on 2026-09-25, plus stable canonical sources (System Design Primer, MIT 6.5840 schedule, Kleppmann's Cambridge
course, Google SRE book). Videos use YouTube search links so they never break.
Structure: Topic -> Subtopic (lesson). Each lesson: learn / deep dive / practice / apply resources + a recall question.
"""
import json, os
from urllib.parse import quote_plus

HERE = os.path.dirname(__file__)

VERIFIED = set(open(os.path.join(HERE, 'bbg_verified.txt')).read().split())
def bbg(slug, title):
    assert slug in VERIFIED, 'unverified ByteByteGo slug ' + slug
    return {'title': f'ByteByteGo: {title}', 'url': f'https://bytebytego.com/guides/{slug}/', 'kind': 'learn', 'medium': 'article'}
def bbc(slug, title):  # free chapters of Alex Xu's System Design Interview on ByteByteGo
    return {'title': f'System Design Interview (Alex Xu): {title}', 'url': f'https://bytebytego.com/courses/system-design-interview/{slug}', 'kind': 'deep', 'medium': 'book'}
def hi(path, title, kind='learn'):
    return {'title': f'Hello Interview: {title}', 'url': f'https://www.hellointerview.com/learn/system-design/{path}', 'kind': kind, 'medium': 'article'}
def yt(q, title=None, kind='learn'):
    return {'title': title or f'Video: {q}', 'url': 'https://www.youtube.com/results?search_query=' + quote_plus(q), 'kind': kind, 'medium': 'video'}
def primer(anchor, title):
    return {'title': f'System Design Primer: {title}', 'url': f'https://github.com/donnemartin/system-design-primer#{anchor}', 'kind': 'deep', 'medium': 'article'}
def mit(notes, paper=None, title=''):
    r = [{'title': f'MIT 6.5840 lecture notes: {title}', 'url': f'https://pdos.csail.mit.edu/6.824/notes/{notes}', 'kind': 'deep', 'medium': 'course'}]
    if paper:
        r.append({'title': f'Paper: {title}', 'url': f'https://pdos.csail.mit.edu/6.824/papers/{paper}', 'kind': 'deep', 'medium': 'paper'})
    return r
def link(title, url, kind='learn', medium='article'):
    return {'title': title, 'url': url, 'kind': kind, 'medium': medium}
def practice(prompt):
    return {'title': f'Practice: {prompt}', 'url': '', 'kind': 'practice', 'medium': 'exercise'}

KLEPP_PLAYLIST = 'https://www.youtube.com/playlist?list=PLeKd45zvjcDFUEv_ohr_HdUFe97RItdiB'
KLEPP_NOTES = 'https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf'

def L(id, title, summary, resources, recall):
    return {'id': 'sd.' + id, 'title': title, 'summary': summary, 'resources': resources, 'recall': recall}

topics = [
  {'id': 'sd.foundations', 'title': 'Foundations', 'summary': 'How the internet works end to end, the numbers every engineer should know, and what “scalable” and “available” really mean.', 'children': [
    L('f.url', 'What happens when you type a URL', 'DNS → TCP/TLS handshake → HTTP request → server → rendering. The mental model for every design.',
      [bbg('what-happens-when-you-type-a-url-into-your-browser', 'What happens when you type a URL'), bbg('what-happens-when-you-type-google', 'What happens when you type google.com'), yt('ByteByteGo what happens when you type a URL into your browser')],
      'Walk through every hop from typing a URL to seeing the page. Where can latency hide?'),
    L('f.network', 'Networking essentials: OSI, TCP vs UDP, HTTP/1→2→3', 'The layers you actually reason about in interviews: L4 (TCP/UDP) and L7 (HTTP), and why HTTP/2 and 3 exist.',
      [hi('core-concepts/networking-essentials', 'Networking Essentials'), bbg('what-is-osi-model', 'OSI Model Explained'), bbg('http1-http2-http3', 'HTTP/1 → HTTP/2 → HTTP/3'), bbg('what-protocol-does-online-gaming-use-to-transmit-data', 'TCP vs UDP'), yt('ByteByteGo TCP vs UDP')],
      'When would you pick UDP over TCP? What problem does HTTP/2 multiplexing solve, and what does HTTP/3 fix on top?'),
    L('f.numbers', 'Latency numbers & back-of-the-envelope estimation', 'Memory vs SSD vs network costs, QPS, storage and bandwidth math in two minutes.',
      [hi('core-concepts/numbers-to-know', 'Numbers to Know'), bbg('which-latency-numbers-should-you-know', 'Latency numbers you should know'), bbc('back-of-the-envelope-estimation', 'Back-of-the-envelope estimation'), link('Latency numbers every programmer should know (Jeff Dean)', 'https://gist.github.com/jboner/2841832', 'deep'), practice('Estimate QPS and 5-year storage for a Twitter-like app with 200M daily users')],
      'Roughly how long is a main-memory read vs an SSD read vs a cross-continent round trip? Estimate daily storage for 100M photos/day at 2 MB.'),
    L('f.scale', 'Scaling from zero to millions of users', 'Single server → DB split → load balancer → replication → cache → CDN → stateless tier → sharding → queues.',
      [bbc('scale-from-zero-to-millions-of-users', 'Scale from zero to millions of users'), bbg('how-to-scale-a-website-to-support-millions-of-users', 'Scaling websites for millions of users'), bbg('8-must-know-scalability-strategies', '8 must-know scalability strategies'), primer('performance-vs-scalability', 'Performance vs scalability'), yt('ByteByteGo scale from zero to millions of users')],
      'List the steps to evolve a single-server app to millions of users, and the bottleneck each step removes.'),
    L('f.avail', 'Availability, reliability & fault tolerance', 'Nines, SLAs/SLOs, redundancy, failover (active-passive/active-active), and designing for failure.',
      [bbg('how-do-we-design-for-high-availability', 'How to design for high availability'), bbg('a-cheat-sheet-for-designing-fault-tolerant-systems', 'Designing fault-tolerant systems'), primer('availability-patterns', 'Availability patterns'), link('Google SRE book: Embracing risk & SLOs', 'https://sre.google/sre-book/table-of-contents/', 'deep', 'book')],
      'How much downtime per year is 99.9% vs 99.99%? How does active-active differ from active-passive failover?'),
    L('f.tradeoffs', 'Core trade-offs', 'Latency vs throughput, consistency vs availability, SQL vs NoSQL, sync vs async, batch vs stream.',
      [bbg('top-5-trade-offs-in-system-designs', 'Top 5 trade-offs'), bbg('10-system-design-tradeoffs-you-cannot-ignore', '10 trade-offs you cannot ignore'), primer('latency-vs-throughput', 'Latency vs throughput'), bbg('system-design-blueprint-the-ultimate-guide', 'System design blueprint')],
      'Name five classic system design trade-offs and one situation where you would choose each side.'),
  ]},
  {'id': 'sd.net', 'title': 'Networking, APIs & the edge', 'summary': 'Everything between the user and your services: DNS, CDNs, load balancers, gateways, API styles and real-time connections.', 'children': [
    L('n.dns', 'DNS', 'Resolution chain, record types, TTLs and DNS-based load balancing / geo routing.',
      [bbg('how-does-the-domain-name-system-dns-lookup-work', 'How DNS lookup works'), bbg('dns-record-types-you-should-know', 'DNS record types'), primer('domain-name-system', 'Domain Name System'), bbg('internet-traffic-routing-policies', 'Traffic routing policies')],
      'Walk through a DNS lookup from browser cache to authoritative server. What does TTL trade off?'),
    L('n.cdn', 'CDN', 'Push vs pull CDNs, edge caching, cache keys and invalidation.',
      [bbg('a-beginners-guide-to-cdn-content-delivery-network', "A beginner's guide to CDN"), bbg('how-does-cnd-work', 'How does a CDN work'), primer('content-delivery-network', 'Content delivery network'), yt('ByteByteGo CDN explained')],
      'Push vs pull CDN — when would you use each? How do you invalidate stale content?'),
    L('n.lb', 'Load balancers', 'L4 vs L7, algorithms (round robin, least connections, consistent hashing), health checks, sticky sessions.',
      [bbg('what-is-a-load-balancer', 'What is a load balancer'), bbg('load-balancer-realistic-use-cases-you-may-not-know', 'Load balancer use cases'), primer('load-balancer', 'Load balancer'), yt('ByteByteGo load balancing algorithms')],
      'Compare L4 and L7 load balancing. Which algorithm would you use for long-lived WebSocket connections?'),
    L('n.proxy', 'Reverse proxy & API gateway', 'What each does, and how they differ from a load balancer.',
      [bbg('reverse-proxy-vs-api-gateway-vs-load-balancer', 'Reverse proxy vs API gateway vs load balancer'), bbg('proxy-vs-reverse-proxy', 'Proxy vs reverse proxy'), hi('deep-dives/api-gateway', 'API Gateway'), bbg('api-gateway-101', 'API Gateway 101')],
      'What responsibilities belong in an API gateway (auth, rate limiting, routing…)? What stays in services?'),
    L('n.api', 'API design: REST, gRPC, GraphQL', 'Resource modelling, status codes, pagination, versioning, idempotency and when to use each style.',
      [hi('core-concepts/api-design', 'API Design'), bbg('rest-api-vs-graphql', 'REST vs GraphQL'), bbg('what-is-grpc', 'What is gRPC'), bbg('how-do-we-perform-pagination-in-api-design', 'Pagination in API design'), bbg('top-6-cases-to-apply-idempotency', 'Where to apply idempotency'), practice('Design the REST API for a URL shortener, including pagination and error codes')],
      'Offset vs cursor pagination — which scales and why? How do you make a POST /payments endpoint idempotent?'),
    L('n.realtime', 'Real-time: polling, SSE, WebSockets', 'Short/long polling, server-sent events and WebSockets, and how to scale persistent connections.',
      [hi('patterns/realtime-updates', 'Real-time updates pattern'), bbg('shortlong-polling-sse-websocket', 'Short/long polling, SSE, WebSocket'), bbg('polling-vs-webhooks', 'Polling vs webhooks'), yt('Hello Interview real-time updates websockets SSE')],
      'Pick a transport for live comments, a stock ticker and a chat app. How do you route a message to the server holding a user’s socket?'),
    L('n.ratelimit', 'Rate limiting', 'Token bucket, leaky bucket, fixed/sliding windows, and distributed rate limiting with Redis.',
      [bbc('design-a-rate-limiter', 'Design a rate limiter'), hi('problem-breakdowns/distributed-rate-limiter', 'Rate Limiter breakdown', 'practice'), yt('ByteByteGo rate limiting algorithms')],
      'Explain token bucket vs sliding-window log. How do you enforce one limit across 50 API servers?'),
  ]},
  {'id': 'sd.data', 'title': 'Databases & storage', 'summary': 'Choosing, modelling, indexing, replicating and partitioning data — the heart of most designs.', 'children': [
    L('d.types', 'SQL vs NoSQL & choosing a database', 'Relational, key-value, document, wide-column, graph, time-series, search — and how to pick.',
      [bbg('types-of-databases', 'Types of databases'), bbg('how-to-choose-the-right-database', 'How to choose the right database'), hi('core-concepts/data-modeling', 'Data Modeling'), primer('sql-or-nosql', 'SQL or NoSQL')],
      'Give a workload that fits each: relational, key-value, wide-column, document, graph. What makes you leave SQL?'),
    L('d.index', 'Indexing: B-trees vs LSM-trees', 'How indexes speed reads and slow writes; B-tree vs LSM, secondary and composite indexes.',
      [hi('core-concepts/db-indexing', 'Database Indexing'), bbg('b-tree-vs', 'B-Tree vs LSM-Tree'), bbg('8-data-structures-that-power-your-databases', '8 data structures that power databases'), link('CMU 15-445 Database Systems (Andy Pavlo)', 'https://15445.courses.cs.cmu.edu/', 'deep', 'course')],
      'Why are LSM-trees write-optimised and B-trees read-optimised? When does a composite index not help?'),
    L('d.acid', 'Transactions, ACID, isolation & locking', 'Isolation levels and the anomalies they prevent, optimistic vs pessimistic locking.',
      [bbg('what-does-acid-mean', 'What does ACID mean'), bbg('what-are-database-isolation-levels', 'Database isolation levels'), bbg('pessimistic-vs-optimistic-locking', 'Pessimistic vs optimistic locking'), bbg('what-are-the-differences-among-database-locks', 'Database locks explained')],
      'Which anomaly does each isolation level prevent (dirty read, non-repeatable read, phantom)? When is optimistic locking better?'),
    L('d.repl', 'Replication', 'Leader-follower, multi-leader, leaderless; sync vs async; read replicas and replication lag.',
      [bbg('how-to-implement-read-replica-pattern', 'Read replica pattern'), primer('master-slave-replication', 'Replication'), hi('patterns/scaling-reads', 'Scaling Reads'), yt('Martin Kleppmann replication')],
      'What goes wrong with async replication + read replicas (read-your-writes)? How do you fix it?'),
    L('d.shard', 'Sharding & partitioning', 'Range vs hash partitioning, hot keys, resharding, cross-shard queries.',
      [hi('core-concepts/sharding', 'Sharding'), bbg('a-crash-course-in-database-sharding', 'Crash course on sharding'), bbg('top-4-data-sharding-algorithms-explained', 'Top 4 sharding algorithms'), bbg('vertical-partitioning-vs-horizontal-partitioning', 'Vertical vs horizontal partitioning'), hi('patterns/scaling-writes', 'Scaling Writes')],
      'Pick a shard key for a chat app’s messages table. What happens with a celebrity (hot key)?'),
    L('d.ch', 'Consistent hashing', 'Hash rings, virtual nodes and minimal data movement when nodes join/leave.',
      [hi('core-concepts/consistent-hashing', 'Consistent Hashing'), bbc('design-consistent-hashing', 'Design consistent hashing'), bbg('consistent-hashing', 'Consistent hashing explained'), yt('ByteByteGo consistent hashing')],
      'Why does mod-N hashing break when you add a server? How do virtual nodes fix uneven load?'),
    L('d.blob', 'Blob/object storage & large files', 'S3-style storage, presigned URLs, multipart uploads, erasure coding.',
      [hi('patterns/large-blobs', 'Handling Large Blobs'), bbg('how-to-upload-a-large-file-to-s3', 'Uploading a large file to S3'), bbg('erasure-coding', 'Erasure coding'), bbg('explain-the-top-6-use-cases-of-object-stores', 'Object store use cases')],
      'Why upload directly to S3 with a presigned URL instead of through your servers? How does multipart upload resume?'),
    L('d.special', 'Search, time-series & specialised stores', 'Elasticsearch/inverted indexes, time-series DBs, geospatial indexes, vector DBs.',
      [hi('deep-dives/elasticsearch', 'Elasticsearch'), hi('deep-dives/time-series-databases', 'Time Series Databases'), hi('deep-dives/proximity-search', 'Proximity Search'), hi('deep-dives/vector-databases', 'Vector Databases'), hi('deep-dives/data-structures-for-big-data', 'Data structures for big data')],
      'How does an inverted index answer a text query? How would you find restaurants within 2 km (geohash/quadtree)?'),
    L('d.tech', 'Key databases to know: Postgres, DynamoDB, Cassandra, Redis', 'Enough internals of the usual suspects to justify choosing them.',
      [hi('deep-dives/postgres', 'PostgreSQL'), hi('deep-dives/dynamodb', 'DynamoDB'), hi('deep-dives/cassandra', 'Cassandra'), hi('deep-dives/redis', 'Redis'), link('Amazon Dynamo paper (2007)', 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf', 'deep', 'paper')],
      'When would you choose Cassandra over Postgres? What does DynamoDB’s partition key + sort key model enable?'),
  ]},
  {'id': 'sd.cache', 'title': 'Caching', 'summary': 'The cheapest way to scale reads — and the easiest way to serve stale data.', 'children': [
    L('c.strategies', 'Caching strategies', 'Cache-aside, read-through, write-through, write-behind, write-around.',
      [hi('core-concepts/caching', 'Caching'), bbg('top-5-caching-strategies', 'Top 5 caching strategies'), bbg('what-are-the-top-caching-strategies', 'Top caching strategies'), primer('cache', 'Cache')],
      'Explain cache-aside vs write-through. Which keeps the cache and DB most consistent, and at what cost?'),
    L('c.evict', 'Eviction & invalidation', 'LRU/LFU/TTL, invalidation strategies and cache consistency.',
      [bbg('top-8-cache-eviction-strategies', 'Top 8 eviction strategies'), bbg('things-to-consider-when-using-cache', 'Things to consider when using cache'), practice('Implement an LRU cache (LeetCode 146) and explain its O(1) operations')],
      'LRU vs LFU — when does each fail? How do you invalidate a cached user profile after an update?'),
    L('c.problems', 'When caches go wrong', 'Thundering herd / stampede, penetration, avalanche, hot keys.',
      [bbg('how-can-cache-systems-go-wrong', 'How can cache systems go wrong'), bbg('cache-miss-attack', 'Cache miss attack'), hi('problem-breakdowns/distributed-cache', 'Design a distributed cache', 'practice')],
      'What is a cache stampede and three ways to prevent it? How do you handle a hot key?'),
    L('c.redis', 'Redis deep dive', 'Data structures, single-threaded speed, persistence (RDB/AOF), cluster mode, common uses.',
      [bbg('why-is-redis-so-fast', 'Why is Redis so fast'), bbg('how-can-redis-be-used', 'How Redis can be used'), bbg('how-does-redis-persist-data', 'How Redis persists data'), hi('deep-dives/redis', 'Redis deep dive')],
      'Why is single-threaded Redis so fast? Name four problems Redis solves beyond caching.'),
  ]},
  {'id': 'sd.async', 'title': 'Messaging & async processing', 'summary': 'Decoupling services with queues and streams, and processing data in batches or in real time.', 'children': [
    L('a.queues', 'Message queues vs event streams', 'Point-to-point queues vs pub/sub logs; RabbitMQ vs Kafka; back-pressure.',
      [bbg('types-of-message-queue', 'Types of message queues'), bbg('how-do-message-queue-architectures-evolve', 'Message queue evolution'), primer('asynchronism', 'Asynchronism'), bbc('distributed-message-queue', 'Distributed message queue (preview)')],
      'When do you want a queue (work distribution) vs a log (replayable stream)? What is back-pressure?'),
    L('a.kafka', 'Kafka deep dive', 'Topics, partitions, consumer groups, ordering, retention and why it is fast.',
      [hi('deep-dives/kafka', 'Kafka'), bbg('the-ultimate-kafka-101-you-cannot-miss', 'Kafka 101'), bbg('why-is-kafka-fast', 'Why is Kafka fast'), bbg('can-kafka-lose-messages', 'Can Kafka lose messages')],
      'How does Kafka guarantee ordering, and at what granularity? How do consumer groups scale reads?'),
    L('a.semantics', 'Delivery semantics & idempotency', 'At-most/at-least/exactly-once, dedupe keys, outbox pattern.',
      [bbg('delivery-semantics', 'Delivery semantics'), bbg('top-6-cases-to-apply-idempotency', 'Idempotency'), bbg('how-do-we-retry-on-failures', 'Retry strategies')],
      'Why is exactly-once delivery mostly a myth? How do idempotent consumers give you “effectively once”?'),
    L('a.events', 'Event-driven architecture, event sourcing & CDC', 'Events as the source of truth, CQRS, change data capture from the DB log.',
      [bbg('how-do-we-incorporate-event-sourcing-into-the-systems', 'Event sourcing'), bbg('change-data-capture-key-to-leverage-real-time-data', 'Change data capture'), hi('deep-dives/change-data-capture', 'CDC deep dive'), bbg('mcdonalds-event-driven-architecture', "McDonald's event-driven architecture")],
      'What problem does CDC solve compared with dual writes? What are the costs of event sourcing?'),
    L('a.stream', 'Batch vs stream processing & workflows', 'MapReduce, stream processors (Flink), windowing, and durable workflows for long-running jobs.',
      [hi('deep-dives/flink', 'Flink'), hi('patterns/long-running-tasks', 'Managing long-running tasks'), hi('patterns/multi-step-processes', 'Multi-step processes'), hi('deep-dives/temporal', 'Temporal (workflows)')] + mit('l01.txt', 'mapreduce.pdf', 'MapReduce'),
      'Tumbling vs sliding windows — give an example of each. How would you run a 3-step order workflow that must survive crashes?'),
  ]},
  {'id': 'sd.dist', 'title': 'Distributed systems theory', 'summary': 'The “why” behind databases and queues: consistency, time, consensus and failure. Crucial for infra / storage roles.', 'children': [
    L('ds.cap', 'CAP, PACELC & consistency models', 'Linearizability, sequential, causal and eventual consistency — and what CAP really says.',
      [hi('core-concepts/cap-theorem', 'CAP Theorem'), bbg('cap-theorem-one-of-the-most-misunderstood-terms', 'CAP theorem misunderstood'), bbg('top-eventual-consistency-patterns-you-must-know', 'Eventual consistency patterns'), primer('consistency-patterns', 'Consistency patterns')] + mit('l-linearizability.txt', 'p463-herlihy.pdf', 'Linearizability'),
      'State CAP precisely. Why is it really “during a partition, choose C or A”? What does PACELC add?'),
    L('ds.time', 'Time, clocks & ordering', 'Physical clock skew, Lamport clocks, vector clocks, happens-before.',
      [link('Kleppmann: Distributed Systems lectures (Cambridge)', KLEPP_PLAYLIST, 'learn', 'video'), link('Kleppmann lecture notes (PDF)', KLEPP_NOTES, 'deep', 'book'), bbg('do-you-know-why-meta-google-and-amazon-all-stop-using-leap-seconds', 'Why big tech stopped using leap seconds')],
      'Why can’t you order events across machines with wall-clock timestamps? What do vector clocks capture that Lamport clocks can’t?'),
    L('ds.consensus', 'Replication & consensus: Raft, Paxos', 'Leader election, log replication, quorums, split brain.',
      [link('Raft: interactive visualisation', 'http://thesecretlivesofdata.com/raft/', 'learn', 'interactive'), link('The Raft site (paper + visualisations)', 'https://raft.github.io/', 'deep', 'paper')] + mit('l-raft.txt', 'raft-extended.pdf', 'Raft') + mit('l-paxos.txt', 'paxos-simple.pdf', 'Paxos Made Simple'),
      'How does Raft elect a leader and commit a log entry? Why do you need a majority quorum?'),
    L('ds.txn', 'Distributed transactions: 2PC & sagas', 'Two-phase commit, its blocking problem, sagas with compensations, Spanner’s TrueTime.',
      [bbg('top-7-most-used-distributed-system-patterns', 'Top 7 distributed system patterns'), bbg('orchestration-vs-choreography-microservices', 'Orchestration vs choreography')] + mit('l-2pc.txt', None, 'Distributed transactions (2PC)') + mit('l-spanner.txt', 'spanner.pdf', 'Spanner'),
      'Why is 2PC called blocking? How does a saga keep an order + payment + inventory flow consistent?'),
    L('ds.coord', 'Coordination: ZooKeeper, locks, leader election', 'Distributed locks, fencing tokens, service discovery.',
      [hi('deep-dives/zookeeper', 'ZooKeeper'), bbg('why-do-we-need-to-use-a-distributed-lock', 'Why use a distributed lock'), hi('patterns/dealing-with-contention', 'Dealing with contention')] + mit('l-zookeeper.txt', 'zookeeper.pdf', 'ZooKeeper'),
      'Why is a distributed lock without a fencing token unsafe? How would you avoid double-booking a seat?'),
    L('ds.failure', 'Failure detection, gossip & unique IDs', 'Heartbeats, phi-accrual, gossip membership; Snowflake-style ID generation.',
      [bbg('how-do-we-detect-node-failures-in-distributed-systems', 'Detecting node failures'), bbg('explaining-5-unique-id-generators-in-distributed-systems', '5 unique ID generators'), bbc('design-a-unique-id-generator-in-distributed-systems', 'Unique ID generator (preview)')],
      'Design a 64-bit unique ID that is roughly time-sortable. How does gossip spread membership info?'),
    L('ds.papers', 'Classic papers: GFS, Dynamo, Bigtable, Memcache, Chain replication', 'How real systems combine the theory — read the MIT 6.5840 notes alongside.',
      mit('l-gfs.txt', 'gfs.pdf', 'GFS') + mit('l-memcached.txt', 'memcache-fb.pdf', 'Memcache at Facebook') + mit('l-cr.txt', 'cr-osdi04.pdf', 'Chain Replication') + [link('Amazon Dynamo paper', 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf', 'deep', 'paper'), bbg('25-papers-that-completely-transformed-the-computer-world', '25 papers that transformed computing')],
      'What single-master design choice did GFS make and why? How did Facebook keep memcache consistent with MySQL?'),
  ]},
  {'id': 'sd.arch', 'title': 'Architecture patterns', 'summary': 'How services are structured and talk to each other — and how they survive failure.', 'children': [
    L('ar.micro', 'Monolith vs microservices', 'When to split, service boundaries, the costs of distribution.',
      [bbg('what-does-a-typical-microservice-architecture-look-like', 'Typical microservice architecture'), bbg('9-best-practices-for-building-microservices', '9 best practices for microservices'), bbg('is-microservice-architecture-the-silver-bullet', 'Is microservice architecture the silver bullet?'), bbg('top-5-software-architectural-patterns', 'Top 5 architectural patterns')],
      'Give three reasons to stay a monolith and three signals it is time to split.'),
    L('ar.comm', 'Service communication', 'Sync (REST/gRPC) vs async (events), orchestration vs choreography, service discovery.',
      [bbg('orchestration-vs-choreography-microservices', 'Orchestration vs choreography'), bbg('top-9-architectural-patterns-for-data-and-communication-flow', 'Data & communication flow patterns'), bbg('top-6-cloud-messaging-patterns', 'Cloud messaging patterns')],
      'Orchestration vs choreography for an order workflow — pros and cons of each?'),
    L('ar.resilience', 'Resiliency patterns', 'Timeouts, retries with backoff + jitter, circuit breakers, bulkheads, rate limiting, graceful degradation.',
      [bbg('resiliency-patterns', 'Resiliency patterns'), bbg('how-do-we-retry-on-failures', 'Retry strategies'), bbg('a-cheat-sheet-for-designing-fault-tolerant-systems', 'Fault-tolerant systems cheat sheet')],
      'Why add jitter to retries? What does a circuit breaker do in each of its three states?'),
    L('ar.design', 'Design patterns & DDD basics', 'OOP principles, common design patterns, bounded contexts — for low-level design rounds.',
      [bbg('18-key-design-patterns-every-developer-should-know', '18 key design patterns'), bbg('8-key-oop-concepts-every-developer-should-know', '8 key OOP concepts'), bbg('8-key-concepts-in-ddd', '8 key concepts in DDD'), bbg('cap-base-solid-kiss-what-do-these-acronyms-mean', 'CAP, BASE, SOLID, KISS')],
      'Explain SOLID with one example each. Which design pattern would you use for pluggable payment providers?'),
  ]},
  {'id': 'sd.ops', 'title': 'Reliability, observability & security', 'summary': 'Running systems in production: monitoring, SRE practices, deployments and security basics.', 'children': [
    L('o.observe', 'Monitoring, logging & tracing', 'Metrics vs logs vs traces, golden signals, alerting.',
      [bbg('logging-tracing-metrics', 'Logging, tracing, metrics'), link('Google SRE book: Monitoring distributed systems', 'https://sre.google/sre-book/monitoring-distributed-systems/', 'deep', 'book'), bbg('cloud-monitoring-cheat-sheet', 'Cloud monitoring cheat sheet'), bbg('what-is-elk-stack-and-why-is-it-so-popular-for-log-management', 'ELK stack'), hi('problem-breakdowns/metrics-monitoring', 'Design metrics monitoring', 'practice')],
      'What are the four golden signals? When do you reach for a trace instead of logs?'),
    L('o.sre', 'SRE: SLOs, error budgets, incident response', 'Service level objectives, error budgets, toil, postmortems.',
      [link('Google SRE book (free)', 'https://sre.google/sre-book/table-of-contents/', 'deep', 'book'), link('Google SRE book: Service Level Objectives', 'https://sre.google/sre-book/service-level-objectives/', 'learn', 'book')],
      'Difference between SLI, SLO and SLA? How does an error budget decide whether to ship features?'),
    L('o.deploy', 'Deployment & CI/CD', 'Blue-green, canary, feature flags, rollbacks, containers and Kubernetes basics.',
      [bbg('how-do-companies-ship-code-to-production', 'How companies ship code to production'), bbg('cicd-pipeline-explained-in-simple-terms', 'CI/CD explained'), bbg('top-5-most-used-deployment-strategies', 'Top 5 deployment strategies'), bbg('how-does-docker-work', 'How Docker works')],
      'Canary vs blue-green: how does each limit blast radius? How do you roll back a bad DB migration?'),
    L('o.security', 'Security essentials', 'AuthN vs AuthZ, sessions vs JWT, OAuth 2.0, HTTPS/TLS, secrets and encryption.',
      [bbg('session-cookie-jwt-token-sso-and-oauth-2', 'Session, cookie, JWT, SSO, OAuth'), bbg('oauth-2-explained-with-siple-terms', 'OAuth 2.0 explained'), bbg('oauth-20-flows', 'OAuth 2.0 flows'), bbg('how-does-https-work', 'How HTTPS works'), bbg('how-do-we-design-a-secure-system', 'Designing a secure system'), bbg('how-to-store-passwords-in-the-database', 'Storing passwords safely')],
      'Sessions vs JWT — trade-offs? Walk through the OAuth authorization-code flow.'),
  ]},
  {'id': 'sd.interview', 'title': 'The interview framework', 'summary': 'How to run a 45-minute system design interview so your knowledge actually shows.', 'children': [
    L('i.framework', 'Delivery framework', 'Requirements → core entities → API → high-level design → deep dives. Timeboxing.',
      [hi('in-a-hurry/delivery', 'Delivery Framework'), bbc('a-framework-for-system-design-interviews', 'A framework for system design interviews'), bbg('how-to-ace-system-design-interviews-like-a-boss', 'How to ace system design interviews'), hi('in-a-hurry/how-to-prepare', 'How to prepare')],
      'List the stages of a system design interview with rough minutes for each.'),
    L('i.requirements', 'Requirements & estimation', 'Functional vs non-functional requirements; what to estimate and what to skip.',
      [hi('in-a-hurry/introduction', 'System design in a hurry'), bbc('back-of-the-envelope-estimation', 'Estimation'), practice('Write functional + non-functional requirements for Instagram in 3 minutes')],
      'Which non-functional requirements matter most for a payment system vs a news feed?'),
    L('i.patterns', 'Common patterns', 'Scaling reads/writes, contention, real-time updates, long-running tasks, large blobs, multi-step processes.',
      [hi('in-a-hurry/patterns', 'Common patterns'), hi('patterns/scaling-reads', 'Scaling reads'), hi('patterns/scaling-writes', 'Scaling writes'), hi('patterns/dealing-with-contention', 'Dealing with contention')],
      'Which pattern applies to: ticket booking, a view counter, a video upload, a live leaderboard?'),
    L('i.tech', 'Key technologies cheat sheet', 'The components you should be able to justify: Redis, Kafka, Postgres, Cassandra, DynamoDB, Elasticsearch, S3, API gateway.',
      [hi('in-a-hurry/key-technologies', 'Key technologies'), bbg('must-know-system-design-building-blocks', 'Must-know building blocks'), bbg('a-cheat-sheet-for-system-designs', 'System design cheat sheet'), bbg('system-design-cheat-sheet', 'Another cheat sheet')],
      'For each: Redis, Kafka, Cassandra, Elasticsearch, S3 — one-line “when I’d use it”.'),
  ]},
]

# Classic designs: each is a practice lesson
designs = [
  ('url', 'URL shortener (Bitly)', 'bitly', 'design-a-url-shortener', 'Base62 vs hashing for short codes, read-heavy caching, custom aliases, analytics.', 'How do you generate unique short codes at scale without collisions? How do redirects stay fast?'),
  ('ratelimit', 'Rate limiter', 'distributed-rate-limiter', 'design-a-rate-limiter', 'Algorithms, where to place the limiter, Redis + Lua for atomic counters.', 'Where does the limiter live and how is state shared across servers?'),
  ('kv', 'Distributed key-value store / cache', 'distributed-cache', 'design-a-key-value-store', 'Partitioning, replication, quorum reads/writes, vector clocks, anti-entropy.', 'Explain N, R, W quorums. How are conflicting writes resolved?'),
  ('crawler', 'Web crawler', 'web-crawler', 'design-a-web-crawler', 'URL frontier, politeness, dedupe with bloom filters, fault tolerance.', 'How do you avoid crawling the same page twice and overloading one site?'),
  ('notify', 'Notification system', 'notification-system', 'design-a-notification-system', 'Fan-out to push/SMS/email, templates, retries, user preferences, rate limits.', 'How do you guarantee a notification is sent once even if a worker crashes?'),
  ('feed', 'News feed (Facebook / Twitter)', 'fb-news-feed', 'design-a-news-feed-system', 'Fan-out on write vs read, celebrity problem, ranking, caching timelines.', 'Fan-out on write vs on read — which for normal users and which for celebrities?'),
  ('chat', 'Chat app (WhatsApp)', 'whatsapp', 'design-a-chat-system', 'WebSocket gateways, message ordering, delivery receipts, offline sync, group chats.', 'How does a message reach a user connected to a different server? How are receipts tracked?'),
  ('autocomplete', 'Search autocomplete / Top-K', 'top-k', 'design-a-search-autocomplete-system', 'Tries, top-k aggregation, streaming counts, caching prefixes.', 'How do you keep the top-10 suggestions per prefix fresh without recomputing everything?'),
  ('youtube', 'Video platform (YouTube)', 'youtube', 'design-youtube', 'Upload pipeline, transcoding, adaptive bitrate streaming, CDN.', 'What happens between upload and playable video? How does adaptive bitrate work?'),
  ('dropbox', 'File sync (Dropbox / Google Drive)', 'dropbox', 'design-google-drive', 'Chunking, deduplication, sync conflicts, metadata vs blob storage.', 'Why chunk files? How do you sync edits from two devices?'),
  ('uber', 'Ride sharing (Uber) & proximity (Yelp)', 'uber', 'proximity-service', 'Geospatial indexes, location updates at scale, matching and consistency.', 'How do you find nearby drivers every 4 seconds for millions of users?'),
  ('ticket', 'Booking system (Ticketmaster / hotels)', 'ticketmaster', 'hotel-reservation-system', 'Seat holds, contention, idempotent payments, virtual waiting rooms.', 'How do you stop two users from booking the same seat?'),
  ('ads', 'Ad click aggregator', 'ad-click-aggregator', 'ad-click-event-aggregation', 'Stream processing, windowed aggregation, exactly-once-ish counting, reconciliation.', 'How do you count clicks per ad per minute accurately with late events?'),
  ('payment', 'Payment system', 'payment-system', 'payment-system', 'Idempotency keys, ledgers, reconciliation, PSP integration, retries.', 'Why use a double-entry ledger? How do you avoid charging twice on retry?'),
  ('scheduler', 'Distributed job scheduler', 'job-scheduler', None, 'Scheduling at scale, leasing work, retries, exactly-once execution.', 'How do workers claim jobs so each runs once, even if a worker dies?'),
  ('metrics', 'Metrics monitoring & alerting', 'metrics-monitoring', 'metrics-monitoring-and-alerting-system', 'Time-series storage, downsampling, alert evaluation.', 'How do you store and query billions of data points cheaply?'),
  ('docs', 'Collaborative editor (Google Docs)', 'google-docs', None, 'Operational transforms vs CRDTs, presence, versioning.', 'OT vs CRDT — how does each merge concurrent edits?'),
  ('leaderboard', 'Real-time leaderboard', 'online-chess', 'real-time-gaming-leaderboard', 'Redis sorted sets, sharded rankings, real-time updates.', 'How do you get a user’s rank among 100M players quickly?'),
  ('chatgpt', 'LLM chat service (ChatGPT)', 'chatgpt', None, 'Streaming tokens, GPU scheduling, conversation storage, rate limits.', 'How would you stream tokens to the client and schedule GPU capacity fairly?'),
]
design_children = []
for key, title, hikey, bbkey, summary, recall in designs:
    res = [hi(f'problem-breakdowns/{hikey}', f'{title} breakdown', 'practice')]
    if bbkey:
        res.append(bbc(bbkey, title))
    res.append(yt(f'system design {title}', f'Videos: design {title}', 'learn'))
    res.append(practice(f'Design {title} yourself in 45 min, then compare with the breakdown'))
    design_children.append(L('p.' + key, title, summary, res, recall))
topics.append({'id': 'sd.practice', 'title': 'Classic design problems', 'summary': 'Practice end-to-end designs. Do each on paper first, then compare with the breakdowns.', 'children': design_children})

topics.append({'id': 'sd.real', 'title': 'Real-world architectures', 'summary': 'How big companies actually built it — great material for “tell me about a system you admire”.', 'children': [
    L('r.discord', 'Discord: storing trillions of messages', 'Cassandra → ScyllaDB migration and data services.', [bbg('how-discord-stores-trillions-of-messages', 'How Discord stores trillions of messages')], 'Why did Discord move off Cassandra, and what did request coalescing solve?'),
    L('r.netflix', 'Netflix architecture', 'API evolution, caching and the overall stack.', [bbg('netflixs-overall-architecture', "Netflix's overall architecture"), bbg('evolution-of-the-netflix-api-architecture', 'Netflix API evolution'), bbg('4-ways-netflix-uses-caching-to-hold-user-attention', '4 ways Netflix uses caching')], 'How does Netflix use caching to keep playback fast?'),
    L('r.slack', 'The journey of a Slack message', 'Real-time messaging infrastructure end to end.', [bbg('what-is-the-journey-of-a-slack-message', 'Journey of a Slack message')], 'Trace a Slack message from send to delivery on another device.'),
    L('r.figma', 'Figma: scaling Postgres 100x', 'Vertical partitioning then horizontal sharding of Postgres.', [bbg('100x-postgres-scaling-at-figma', '100X Postgres scaling at Figma')], 'What did Figma do before sharding, and how did they shard Postgres?'),
    L('r.uber', 'Uber tech stack & API layer', 'Microservices evolution at Uber.', [bbg('uber-tech-stack', 'Uber tech stack'), bbg('evolution-of-ubers-api-layer', "Evolution of Uber's API layer")], 'Why did Uber’s API layer need to evolve?'),
    L('r.blogs', 'Keep learning: engineering blogs', 'Follow real design write-ups weekly.', [bbg('top-9-engineering-blog-favorites', 'Top engineering blogs'), link('AWS Builders’ Library', 'https://aws.amazon.com/builders-library/', 'deep', 'article')], 'Name one production design lesson you learned from an engineering blog this month.'),
]})

subject = {
    'id': 'sd', 'title': 'System Design', 'long': 'System Design — from fundamentals to distributed systems',
    'color': '#38bdf8', 'icon': 'i:Layers', 'version': 1,
    'description': 'Foundations → networking → data → caching → messaging → distributed systems → architecture → operations → interview framework → 19 classic designs → real systems. ByteByteGo + Hello Interview + System Design Primer + MIT 6.5840 + Kleppmann.',
    'levels': ['Topic', 'Lesson'],
    'credits': 'Links to ByteByteGo, Hello Interview, System Design Primer, MIT 6.5840, Martin Kleppmann, Google SRE book.',
    'children': topics,
}
out = os.path.join(HERE, '..', 'src', 'study-data', 'sd.json')
json.dump(subject, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print('sd topics', len(topics), 'lessons', sum(len(t['children']) for t in topics), 'resources', sum(len(l['resources']) for t in topics for l in t['children']))
