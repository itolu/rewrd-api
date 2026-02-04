import axios from "axios";
import crypto from "crypto";
import { logger } from "../utils/logger";
import { db } from "../config/db";

interface WebhookPayload {
    id: string;
    event: string;
    created_at: string;
    data: any;
}

export class WebhookService {
    /**
     * Send a webhook to the merchant's configured URL
     * @param merchantId The merchant ID to send the webhook for
     * @param event The event name (e.g., 'customer.created')
     * @param data The event data payload
     */
    async sendWebhook(merchantId: string, event: string, data: any): Promise<void> {
        // Fire and forget - don't block the caller
        this.processWebhook(merchantId, event, data).catch(err => {
            logger.error("Failed to process webhook", {
                merchant_id: merchantId,
                event,
                error: err instanceof Error ? err.message : String(err)
            });
        });
    }

    private async processWebhook(merchantId: string, event: string, data: any): Promise<void> {
        try {
            // 1. Get merchant webhook config
            // Note: status, webhook_url, and webhook_secret columns might not exist yet
            // We fetch essentially 'as any' to check for their existence defensively
            const merchant = await db("Merchants")
                .where({ merchant_id: merchantId })
                .first();

            if (!merchant) {
                logger.warn("Webhook aborted: Merchant not found", { merchant_id: merchantId });
                return;
            }

            // Check if webhook_url exists (defensive check for missing column)
            const webhookUrl = merchant.webhook_url;
            const webhookSecret = merchant.webhook_secret;

            if (!webhookUrl) {
                logger.debug("Webhook aborted: No webhook URL configured", { merchant_id: merchantId });
                return;
            }

            if (!webhookSecret) {
                logger.warn("Webhook aborted: No webhook secret configured", { merchant_id: merchantId });
                return;
            }

            // 2. Prepare payload
            const payload: WebhookPayload = {
                id: crypto.randomUUID(),
                event,
                created_at: new Date().toISOString(),
                data
            };

            const payloadString = JSON.stringify(payload);
            const timestamp = Math.floor(Date.now() / 1000).toString();

            // 3. Generate Signature
            // Format: t=TIMESTAMP,v1=HMAC_SHA256(TIMESTAMP + "." + PAYLOAD)
            const signature = this.generateSignature(payloadString, timestamp, webhookSecret);
            const headerValue = `t=${timestamp},v1=${signature}`;

            // 4. Send with retries
            await this.sendWithRetry(webhookUrl, payload, headerValue, merchantId, event);

        } catch (error) {
            // Log full error context
            logger.error("Error in processWebhook", {
                merchant_id: merchantId,
                event,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private generateSignature(payload: string, timestamp: string, secret: string): string {
        const dataToSign = `${timestamp}.${payload}`;
        return crypto
            .createHmac("sha256", secret)
            .update(dataToSign)
            .digest("hex");
    }

    private async sendWithRetry(
        url: string,
        payload: any,
        signatureHeader: string,
        merchantId: string,
        eventId: string,
        attempt = 1
    ): Promise<void> {
        const MAX_RETRIES = 3;
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;

        try {
            logger.info(`Sending webhook attempt ${attempt}`, { merchant_id: merchantId, event: eventId });

            await axios.post(url, payload, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Rewrd-Signature": signatureHeader,
                    "User-Agent": "Rewrd-Webhook/1.0"
                },
                timeout: 5000 // 5 second timeout
            });

            logger.info("Webhook delivered successfully", { merchant_id: merchantId, event: eventId });

        } catch (error: any) {
            logger.warn(`Webhook attempt ${attempt} failed`, {
                merchant_id: merchantId,
                event: eventId,
                status: error.response?.status,
                error: error.message
            });

            if (attempt < MAX_RETRIES) {
                // Wait and retry
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendWithRetry(url, payload, signatureHeader, merchantId, eventId, attempt + 1);
            } else {
                logger.error("Webhook delivery failed after max retries", {
                    merchant_id: merchantId,
                    event: eventId
                });
                // In a real system, we might store this failure in a DLQ (Dead Letter Queue)
                throw new Error(`Failed to deliver webhook after ${MAX_RETRIES} attempts`);
            }
        }
    }
}

export const webhookService = new WebhookService();
