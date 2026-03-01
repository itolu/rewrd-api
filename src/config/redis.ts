import Redis from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

/**
 * Redis client configuration.
 * We maintain two separate connections:
 * - publisher: for publishing events to the dashboard backend
 * - subscriber: for listening to responses from the dashboard backend
 *
 * This separation is required because a Redis client in subscribe mode
 * cannot issue other commands.
 */

const redisOptions = {
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        logger.warn(`Redis reconnecting... attempt ${times}, next retry in ${delay}ms`);
        return delay;
    },
    lazyConnect: true, // Don't connect until explicitly called
};

export const redisPublisher = new Redis(env.REDIS_URL, redisOptions);
export const redisSubscriber = new Redis(env.REDIS_URL, redisOptions);

// Connection event handlers
redisPublisher.on("connect", () => logger.info("Redis publisher connected"));
redisPublisher.on("error", (err) => logger.error("Redis publisher error", { error: err.message }));

redisSubscriber.on("connect", () => logger.info("Redis subscriber connected"));
redisSubscriber.on("error", (err) => logger.error("Redis subscriber error", { error: err.message }));

/**
 * Initialize Redis connections.
 * Call this at app startup. Failures are logged but don't crash the server.
 */
export async function connectRedis(): Promise<boolean> {
    try {
        await Promise.all([
            redisPublisher.connect(),
            redisSubscriber.connect(),
        ]);
        logger.info("Redis connections established successfully");
        return true;
    } catch (err) {
        logger.error("Failed to connect to Redis", {
            error: err instanceof Error ? err.message : String(err),
            url: env.REDIS_URL.replace(/\/\/.*@/, "//***@"), // Mask credentials in logs
        });
        return false;
    }
}

/**
 * Disconnect Redis connections gracefully.
 */
export async function disconnectRedis(): Promise<void> {
    await Promise.all([
        redisPublisher.quit().catch(() => { }),
        redisSubscriber.quit().catch(() => { }),
    ]);
    logger.info("Redis connections closed");
}
