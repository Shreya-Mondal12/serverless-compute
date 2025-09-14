## Serverless Compute Platform Prototype

*Reimagining compute as a simple, scalable, and resilient utility.*
<br/>

This platform allows developers to submit arbitrary code for execution without managing servers, clusters, or infrastructure.
Inspired by the simplicity of object storage services like AWS S3, this platform abstracts away the complexity of traditional compute scaling. Simply submit a function, and the platform handles the rest—ensuring reliable execution, automatic scaling, and persistent job tracking.

<br/>

### Features

* Submit arbitrary code snippets via API
* Workers execute code asynchronously from a Redis queue
* Scales automatically with worker processes
* Fault tolerance with retries and error logging
* Health-check endpoints for Redis and MongoDB
* Job status tracking (submitted, running, completed, failed)

<br/>

### Project Structure

```
serverless-compute/
│── src/
│   ├── index.js        # API server
│   ├── worker.js       # Worker service
│   ├── queue.js        # Shared queue setup
│── docker-compose.yml  # Orchestration
│── Dockerfile          # Image definition
│── package.json
```

<br/>

### System Architecture
                      ┌───────────────┐
                      │   Developer   │
                      │ (Postman/API) │
                      └───────┬───────┘
                              │
                              ▼
                      ┌────────────────┐
                      │   Express.js   │
                      │    API Layer   │
                      └───────┬────────┘
                              │
                  (enqueue job into Redis)
                              │
                              ▼
                      ┌────────────────┐
                      │    Redis MQ    │
                      │  (job broker)  │
                      └───────┬────────┘
                              │
                    (workers pick up jobs)
                              │
                              ▼
                      ┌────────────────┐
                      │   Worker.js    │
                      │ (executes code)│
                      └───────┬────────┘
                              │
                      (results + logs)
                              │
                              ▼
                      ┌────────────────┐
                      │   MongoDB      │
                      │(store results) │
                      └────────────────┘

<br/>

### Technology Stack

| Technology | Role |
| ---------- | ---- |
| Node.js/Express.js | Core runtime and REST API framework |
| Redis | In-memory data store and message broker for the job queue | 
| BullMQ | A robust, fast, and reliable queue system for Node.js |
| MongoDB | NoSQL database for persistent storage of job results and metadata |
| Docker + Docker Compose | Providing Containerized Microservices | 
| Postman | Efficient API testing by `POST` and `GET` methods |

<br/>

### How to run?
#### 1. Cloning the repository

```
git clone https://github.com/<your-username>/serverless-compute.git
cd serverless-compute
```
In `<your-username>` replace with your GitHub username  

<br/>

#### 2. Starting Services

```
docker-compose up --build
```

This command will build the Docker images and start the following containerized services:
* **API Server**: Accessible at `http://localhost:3000`
* **Worker**: Automatically connects to Redis and starts listening for jobs.
* **Redis**: Accessible on port `6379`.
* **MongoDB**: Accessible on port `27017`.  

<br/>

#### 3. API testing with Postman
  
**Submit Function**
```
POST http://localhost:3000/submit
Content-Type: application/json

{
  "code": "return input * 2;",
  "input": 21
}
```
  
**Response**
```
{ "jobId": "abc123", "status": "submitted" }
```
---------------------------------------------
**Check Job Status**
```
GET http://localhost:3000/status/abc123
```

**Response**
```
{
  "jobId": "abc123",
  "state": "completed",
  "result": 42
}
```
--------------------------------------------
**Health Checks**
* `GET /mongo` -> MongoDB connection test
* `GET /redis ` -> Redis connection test
* `GET /` -> API health check
--------------------------------------------
<br/>

### Deliverables

**1.** Serverless Compute Prototype API
  * Exposed via Express.js running in a container (app service).
  * Provides endpoints:
    * `/execute` → submit job to local queue
    * `/submit` → submit job to shared queue (compute-tasks)
    * `/status/:id` → track execution status & result
    * `/mongo and /redis` → monitoring endpoints for DB/Cache connectivity
  * Developers only need to send function code + input, and the system executes it transparently.
------------------------------------------------------------------------------
**2.** Job Queue with Auto-Scaling via Workers
  * Implemented using **BullMQ + Redis**.
  * The `worker` service automatically consumes jobs from the queue and executes user-provided code.
  * Designed so you can run multiple `worker` containers → simulating **infinite scaling**.
  * Includes execution safety:
    * Function sandboxing using `new Function`
    * Timeout protection (5s default) to avoid infinite loops.
------------------------------------------------------------------------------
**3.** Fault Tolerance with Retries & Logging
  * Each job automatically retries on failure (configurable in BullMQ).
  * Worker logs:
    * ✅ Job started, data, completed, result
    * ❌ Failures with error details
    * ⏳ Timeout handling
  * Ensures system remains reliable even if some executions fail.
------------------------------------------------------------------------------
**4.** Monitoring Endpoints for System Health
  * `/mongo`: Confirms MongoDB connectivity and lists collections.
  * `/redis`: Pings Redis to confirm cache availability.
  * `/status/:id`: Reports job state (`waiting`, `active`, `completed`, `failed`) and result.
  * These act as observability hooks for developers and evaluators.
------------------------------------------------------------------------------
Together, these deliverables show that your prototype satisfies:
  * **Scalability** → Multiple workers can be scaled up/down.
  * **Reliability** → Retries, logging, monitoring in place.
  * **Simplicity** → Easy API to submit code & get result.
  * **Innovation** → “S3 for compute” vision, where developers only drop in code.

<br/>

### Stretch Goals Implemented
* **Developer Experience Enhancement:** Added job status and execution monitoring, giving developers feedback on their function runs.




