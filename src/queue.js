const { Queue } = require("bullmq");
const { Redis } = require("ioredis");

const connection = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null // 👈 required for BullMQ
});

const computeQueue = new Queue("compute-tasks", { connection });

module.exports = { computeQueue };
