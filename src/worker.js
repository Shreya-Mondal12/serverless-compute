const { Worker } = require("bullmq");
const { Redis } = require("ioredis");

// Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null, // required for BullMQ
});

console.log(`[Worker] 🔌 Connected to Redis at ${connection.options.host}:${connection.options.port}`);

// Create Worker
const worker = new Worker(
  "compute-tasks",
  async job => {
    console.log(`[${new Date().toISOString()}] 🚀 Starting job ${job.id} with data:`, job.data);

    if (!job.data || !job.data.code) {
      return "⚠️ No function provided in job data.";
    }

    try {
      // Update job progress in stages
      await job.updateProgress(10); // Started

      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("⏳ Execution timed out"));
        }, 5000);

        try {
          // Simulate progress steps
          setTimeout(() => job.updateProgress(30), 1000);
          setTimeout(() => job.updateProgress(60), 2000);

          const fn = new Function("input", job.data.code);
          const result = fn(job.data.input);

          setTimeout(() => job.updateProgress(90), 3000);

          clearTimeout(timer);
          resolve(result);
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });
    } catch (err) {
      console.error(`[Worker] ❌ Job ${job.id} error: ${err.message}`);
      throw err;
    }
  },
  {
    connection,
    concurrency: 5, // parallel jobs
    lockDuration: 30000,
    settings: {
      retryProcessDelay: 2000,
      backoffStrategies: {
        customBackoff: attempts => Math.min(attempts * 1000, 10000),
      },
    },
  }
);

// Event listeners
worker.on("progress", (job, progress) => {
  console.log(`[${new Date().toISOString()}] 📊 Job ${job.id} progress: ${progress}%`);
});

worker.on("completed", job => {
  console.log(`[${new Date().toISOString()}] ✅ Job ${job.id} completed → Result:`, job.returnvalue);
});

worker.on("failed", (job, err) => {
  console.error(`[${new Date().toISOString()}] ❌ Job ${job?.id} failed: ${err.message}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[Worker] 🛑 Shutting down...");
  await worker.close();
  await connection.quit();
  process.exit(0);
});
