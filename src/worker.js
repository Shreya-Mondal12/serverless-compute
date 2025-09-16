const { Worker } = require("bullmq");
const { Redis } = require("ioredis");

// Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null, // required for BullMQ
});

console.log(
  `[Worker] 🔌 Connected to Redis at ${connection.options.host}:${connection.options.port}`
);

// Create Worker
const worker = new Worker(
  "compute-tasks",
  async (job) => {
    console.log(
      `[${new Date().toISOString()}]  Starting job ${job.id} with data:`,
      job.data
    );

    await job.updateProgress(10);

 
    // ---- Normal job execution ----
    try {
      setTimeout(() => job.updateProgress(30), 1000);
      setTimeout(() => job.updateProgress(60), 2000);

      const fn = new Function("input", job.data.code);
      let result = fn(job.data.input);

      if (result === undefined || Number.isNaN(result)) {
        throw new Error("Computation failed: invalid or undefined result");
      }
      if (typeof result === "bigint") {
        result = result.toString();
      }

      setTimeout(() => job.updateProgress(90), 3000);

      return { success: true, output: result };
    } catch (err) {
      throw err; // important! let BullMQ record as failed
    }
  },
  {
    connection,
    concurrency: 5,
    lockDuration: 30000,
    settings: {
      retryProcessDelay: 2000,
      backoffStrategies: {
        customBackoff: (attempts) => Math.min(attempts * 1000, 10000),
      },
    },
  }
);

// Event listeners
worker.on("progress", (job, progress) => {
  console.log(
    `[${new Date().toISOString()}]  Job ${job.id} progress: ${progress}%`
  );
});

worker.on("completed", (job) => {
  console.log(
    `[${new Date().toISOString()}]  Job ${job.id} completed → Result:`,
    job.returnvalue
  );
});

worker.on("failed", (job, err) => {
  console.error(
    `[${new Date().toISOString()}] Job ${job?.id} failed after attempt ${
      job?.attemptsMade || 0
    }: ${err.message}`
  );
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[Worker]  Shutting down...");
  await worker.close();
  await connection.quit();
  process.exit(0);
});

console.log("[Worker]  Worker is running and waiting for jobs...");
