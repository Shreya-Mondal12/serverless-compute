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

  const job = await computeQueue.add("execute", { code, input });
  res.json({ jobId: job.id, status: "submitted" });
});

// GET /status/:id → check job state/result
app.get("/status/:id", async (req, res) => {
  try {
    const job = await computeQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const state = await job.getState();
    const result = job.returnvalue;
    res.json({ jobId: job.id, state, result });
  } catch (err) {
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

// ---- Start server ----
app.listen(3000, async () => {
  console.log("🌐 API running on http://localhost:3000");
  await getMongo();
  console.log("📡 Ready to receive jobs");
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
