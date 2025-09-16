const express = require("express");
const bodyParser = require("body-parser");
const { Queue } = require("bullmq");
const { MongoClient } = require("mongodb");
const { Redis } = require("ioredis");

const app = express();
app.use(bodyParser.json());

// ---- Mongo Setup ----
const mongoUrl = process.env.MONGO_URI || "mongodb://mongo:27017/serverless";
let mongoClient;

async function getMongo() {
  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    console.log("✅ Connected to Mongo");
  }
  return mongoClient.db("testdb");
}

// ---- Redis + Queue Setup ----
const connection = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const computeQueue = new Queue("compute-tasks", { connection });

// ---- API Endpoints ----

// POST /submit → enqueue job
app.post("/submit", async (req, res) => {
  const { code, input } = req.body;
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  const job = await computeQueue.add(
    "execute",
    { code, input },
    {
      attempts: 3, // retry automatically up to 3 times
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 60 },
      removeOnFail: { count: 50 },
    }
  );

  res.json({ jobId: job.id, status: "submitted" });
});

// GET /status/:id → check job state/result

app.get("/status/:id", async (req, res) => {
  try {
    const job = await computeQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const state = await job.getState();
    const attemptsMade = job.attemptsMade;

    let response = {
      jobId: job.id,
      state,
      attemptsMade,
      progress: job.progress || 0,
      timestamp: {
        created: job.timestamp,
        processed: job.processedOn,
        finished: job.finishedOn,
      },
    };

    if (state === "completed") {
      response.result = job.returnvalue;
    } else if (state === "failed") {
      response.error = job.failedReason || "Unknown error";
      response.stacktrace = job.stacktrace || [];
    }

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching job status:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// GET /mongo → test Mongo connection
app.get("/mongo", async (req, res) => {
  try {
    const db = await getMongo();
    const collections = await db.listCollections().toArray();
    res.json({ status: "MongoDB Connected ✅", collections });
  } catch (err) {
    res.status(500).json({ error: "MongoDB not reachable", details: err.message });
  }
});

// GET /redis → test Redis connection
app.get("/redis", async (req, res) => {
  try {
    const pong = await connection.ping();
    res.json({ status: "Redis Connected ✅", response: pong });
  } catch (err) {
    res.status(500).json({ error: "Redis not reachable", details: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Serverless Compute Prototype Running 🚀");
});

// ---- Job Progress ----
app.get("/job/:id/progress", async (req, res) => {
  try {
    const job = await computeQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const progress = job.progress || 0;
    res.json({ jobId: job.id, progress });
  } catch (err) {
    console.error("❌ Error fetching progress:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- Job History (Mongo) ----
app.get("/jobs/history", async (req, res) => {
  try {
    const db = await getMongo();
    const jobs = await db.collection("jobs").find().sort({ createdAt: -1 }).limit(20).toArray();
    res.json(jobs);
  } catch (err) {
    console.error("❌ Error fetching history:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- Start server ----
app.listen(3000, async () => {
  console.log("🌐 API running on http://localhost:3000");
  await getMongo();
  console.log("📡 Ready to receive jobs");
});
