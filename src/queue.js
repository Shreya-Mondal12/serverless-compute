const { Queue, QueueEvents } = require("bullmq");
const { Redis } = require("ioredis");

// ---- Redis Connection ----
const connection = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null, //  required for BullMQ
});

// ---- Queue Setup ----
const computeQueue = new Queue("compute-tasks", {
  connection,
  defaultJobOptions: {
    attempts: 3, // retry failed jobs up to 3 times
    backoff: {
      type: "exponential",
      delay: 2000, // exponential backoff starting at 2
    },
    removeOnComplete: true, // auto-cleanup finished jobs
    removeOnFail: false,    // keep failed jobs for inspection
  },
});

// ---- Queue Events ----
const queueEvents = new QueueEvents("compute-tasks", { connection });
queueEvents.on("completed", ({ jobId, returnvalue }) => {
  console.log(`[Queue]  Job ${jobId} completed with result:`, returnvalue);
});
queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`[Queue]  Job ${jobId} failed →`, failedReason);
});

// Export
module.exports = { computeQueue, queueEvents };
