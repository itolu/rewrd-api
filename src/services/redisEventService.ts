import crypto from "crypto";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { redisPublisher, redisSubscriber } from "../config/redis";

/**
 * Channel names for Redis pub/sub communication.
 *
 * - EVENTS_CHANNEL: This API publishes requests here
 * - RESULTS_CHANNEL: The dashboard backend publishes responses here
 */
const EVENTS_CHANNEL = "rewrd:events";
const RESULTS_CHANNEL = "rewrd:results";

/** Default timeout for request-reply operations (ms) */
const DEFAULT_TIMEOUT_MS = 300_000;

interface PendingRequest {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
}



interface EventResult {
    correlationId?: string;
    request_id?: string;
    success?: boolean;
    status?: boolean;
    data?: any;
    message?: string;
    error?: {
        message: string;
        code?: string;
        statusCode?: number;
    };
}

/**
 * Redis Event Service
 *
 * Manages inter-service communication between this API and the dashboard
 * backend via Redis pub/sub. Supports two patterns:
 *
 * 1. Request/Reply — publish an event and wait for a correlated response
 * 2. Fire-and-Forget — publish an event without waiting
 *
 * The dashboard backend subscribes to EVENTS_CHANNEL, processes the event,
 * and publishes the result to RESULTS_CHANNEL with the same correlationId.
 */
export class RedisEventService {
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private initialized = false;

    /**
     * Initialize the subscriber to listen for responses.
     * Must be called after Redis connections are established.
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await redisSubscriber.subscribe(RESULTS_CHANNEL);

        redisSubscriber.on("message", (channel: string, message: string) => {
            if (channel !== RESULTS_CHANNEL) return;

            try {
                const result: EventResult = JSON.parse(message);
                this.handleResult(result);
            } catch (err) {
                logger.error("Failed to parse event result", {
                    error: err instanceof Error ? err.message : String(err),
                    rawMessage: message.substring(0, 200),
                });
            }
        });

        this.initialized = true;
        logger.info("RedisEventService initialized, listening on channel", { channel: RESULTS_CHANNEL });
    }

    /**
     * Handle an incoming result from the dashboard backend.
     */
    private handleResult(result: EventResult): void {
        console.log("🚀 ~ RedisEventService ~ handleResult ~ result:", result)

        const correlationId = result.correlationId || result.request_id;
        if (!correlationId) {
            logger.warn("Received result without correlationId or request_id", { result });
            return;
        }

        const pending = this.pendingRequests.get(correlationId);
        if (!pending) {
            logger.warn("Received result for unknown correlationId", {
                correlationId,
            });
            return;
        }

        clearTimeout(pending.timer);
        this.pendingRequests.delete(correlationId);

        const isSuccess = result.success !== undefined ? result.success : result.status;

        if (isSuccess !== false) { // Handle undefined as potentially success if not explicitly false, though status should be explicit
            logger.debug("Event result received (success)", { correlationId });
            pending.resolve(result.data);
        } else {
            logger.warn("Event result received (failure)", {
                correlationId,
                error: result.error || result.message,
            });
            const errorMessage = result.error?.message || result.message || "Remote processing failed";
            const error = new AppError(
                errorMessage,
                result.error?.statusCode || 500,
                result.error?.code || "remote_error"
            );
            pending.reject(error);
        }
    }

    /**
     * Publish an event and wait for the dashboard backend to respond.
     *
     * @param eventType - Event type identifier (e.g. "points.credit", "customer.create")
     * @param payload - Event payload data
     * @param timeoutMs - Maximum time to wait for a response (default: 10s)
     * @returns The response data from the dashboard backend
     * @throws AppError if the request times out or the backend returns an error
     *
     * @example
     * ```ts
     * const ledger = await redisEventService.requestReply("points.credit", {
     *     merchant_id: "mer_abc123",
     *     customer_uid: "cus_def456",
     *     amount: 100,
     *     transaction_type: "member_points_adjustment_credit",
     *     reference_id: "credit_xyz789",
     *     title: "Points Credit",
     * });
     * ```
     */
    async requestReply<T = any>(eventType: string, payload: any, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
        console.log("🚀 ~ RedisEventService ~ requestReply ~ payload:", payload)

        // Extract correlationId from payload.request_id (used by dashboard backend)
        // or generate a new one if not present to avoid errors.
        const correlationId = payload.request_id || crypto.randomUUID();

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(correlationId);
                logger.error("Event request timed out", {
                    eventType,
                    correlationId,
                    timeoutMs,
                });
                reject(new AppError(
                    env.NODE_ENV === "production"
                        ? "Service temporarily unavailable"
                        : `Request to dashboard backend timed out (${eventType})`,
                    504,
                    "event_timeout"
                ));
            }, timeoutMs);

            this.pendingRequests.set(correlationId, { resolve, reject, timer });

            redisPublisher
                .publish(EVENTS_CHANNEL, JSON.stringify(payload))
                .then((subscriberCount) => {
                    logger.info("Event published", {
                        eventType,
                        correlationId,
                        subscriberCount,
                    });
                    if (subscriberCount === 0) {
                        // No subscribers — the dashboard backend might be down
                        clearTimeout(timer);
                        this.pendingRequests.delete(correlationId);
                        reject(new AppError(
                            env.NODE_ENV === "production"
                                ? "Service temporarily unavailable"
                                : "No subscribers available to process the event. Dashboard backend may be offline.",
                            503,
                            "service_unavailable" // More generic code than no_subscribers
                        ));
                    }
                })
                .catch((err) => {
                    clearTimeout(timer);
                    this.pendingRequests.delete(correlationId);
                    reject(new AppError(
                        env.NODE_ENV === "production"
                            ? "Service temporarily unavailable"
                            : "Failed to publish event to Redis",
                        503,
                        "redis_publish_error"
                    ));
                });
        });
    }

    /**
     * Publish an event without waiting for a response.
     * Useful for non-critical events like analytics or logging.
     *
     * @param eventType - Event type identifier
     * @param payload - Event payload data
     */
    async fireAndForget(eventType: string, payload: any): Promise<void> {
        try {
            const correlationId = payload.request_id || crypto.randomUUID();
            const subscriberCount = await redisPublisher.publish(EVENTS_CHANNEL, JSON.stringify(payload));
            logger.debug("Fire-and-forget event published", {
                eventType,
                correlationId,
                subscriberCount,
            });
        } catch (err) {
            logger.error("Failed to publish fire-and-forget event", {
                eventType,
                error: err instanceof Error ? err.message : String(err),
            });
            // Don't throw — fire-and-forget should not break the caller
        }
    }

    /**
     * Get the number of pending requests (useful for health checks).
     */
    get pendingCount(): number {
        return this.pendingRequests.size;
    }

    /**
     * Clean up all pending requests (for graceful shutdown).
     */
    shutdown(): void {
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error("Service shutting down"));
        }
        this.pendingRequests.clear();
        this.initialized = false;
        logger.info("RedisEventService shut down, cleared pending requests");
    }
}

export const redisEventService = new RedisEventService();
