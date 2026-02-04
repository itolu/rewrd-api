import { WebhookService } from "../services/webhookService";
import axios from "axios";
import { db } from "../config/db";
import crypto from "crypto";

jest.mock("axios");
jest.mock("../config/db");
jest.mock("../utils/logger", () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedDb = db as unknown as jest.Mock;

describe("WebhookService", () => {
    let webhookService: WebhookService;
    const merchantId = "mer_123";
    const webhookUrl = "https://example.com/webhook";
    const webhookSecret = "secret_123";
    const event = "customer.created";
    const payloadData = { foo: "bar" };

    beforeEach(() => {
        jest.clearAllMocks();
        webhookService = new WebhookService();

        // Mock DB response for merchant
        mockedDb.mockImplementation(() => ({
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
                merchant_id: merchantId,
                webhook_url: webhookUrl,
                webhook_secret: webhookSecret
            })
        }));
    });

    it("should send webhook with correct signature", async () => {
        mockedAxios.post.mockResolvedValue({ status: 200 });

        // We need to wait for the fire-and-forget promise to resolve
        // Since we can't await the void return of sendWebhook, we act on the internal promise logic
        // But since sendWebhook triggers an async process in the background, we need to inspect the side effects (axios call)
        // However, sendWebhook handles the promise internally.
        // To test it, we can spy on the private method or just wait a tiny bit?
        // Better: we can extract the processing logic or make sendWebhook return the promise for testing?
        // Or we assume it runs fast enough for the expect?
        // The safest way is to cast to any to access private processWebhook OR modify sendWebhook to return promise during tests.
        // For now, let's just await the public method and a small delay

        await webhookService.sendWebhook(merchantId, event, payloadData);

        // Wait for next tick/promise resolution
        await new Promise(process.nextTick);

        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        const [url, data, config] = mockedAxios.post.mock.calls[0];
        const webhookData = data as any;

        expect(url).toBe(webhookUrl);
        expect(webhookData.event).toBe(event);
        expect(webhookData.data).toEqual(payloadData);

        // Verify signature
        const signatureHeader = config?.headers?.["X-Rewrd-Signature"] as string;
        expect(signatureHeader).toBeDefined();

        const [tPart, v1Part] = signatureHeader.split(",");
        const timestamp = tPart.split("=")[1];
        const signature = v1Part.split("=")[1];

        // Recreate signature
        const expectedData = `${timestamp}.${JSON.stringify(data)}`;
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(expectedData)
            .digest("hex");

        expect(signature).toBe(expectedSignature);
    });

    it("should retry on failure", async () => {
        // Fail 2 times, succeed on 3rd
        mockedAxios.post
            .mockRejectedValueOnce(new Error("Network Error"))
            .mockRejectedValueOnce(new Error("Timeout"))
            .mockResolvedValue({ status: 200 });

        jest.useFakeTimers();

        // Call processWebhook directly (not sendWebhook which is fire-and-forget)
        const promise = (webhookService as any).processWebhook(merchantId, event, payloadData);

        // First attempt happens immediately
        await Promise.resolve();
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);

        // Run all timers to trigger the retry setTimeout
        await jest.runAllTimersAsync();

        // All 3 attempts should have completed (initial + 2 retries)
        expect(mockedAxios.post).toHaveBeenCalledTimes(3);

        await promise; // Should resolve successfully

        jest.useRealTimers();
    });

    it("should abort if merchant has no webhook url", async () => {
        mockedDb.mockImplementation(() => ({
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
                merchant_id: merchantId,
                webhook_url: null // Missing URL
            })
        }));

        // Call processWebhook directly to avoid fire-and-forget complexity
        await (webhookService as any).processWebhook(merchantId, event, payloadData);

        expect(mockedAxios.post).not.toHaveBeenCalled();
    });
});
