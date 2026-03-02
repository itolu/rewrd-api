import { Router } from "express";
import {
    getMerchantConfig,
    updateMerchantConfig,
    getEarningRules,
    getEarningRule,
    getIpWhitelist,
    updateIpWhitelist,
    getAnalytics
} from "../controllers/merchantController";
import { validateRequest } from "../middleware/validateRequest";
import { requireMerchant } from "../middleware/requireMerchant";
import {
    updateConfigSchema,
    getRuleSchema,
    updateIpWhitelistSchema,
    getAnalyticsSchema
} from "../schema/merchantSchema";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     MerchantConfig:
 *       type: object
 *       description: Your merchant account configuration including profile, social links, point expiry settings, and security options.
 *       properties:
 *         merchant_id:
 *           type: string
 *           description: Your unique merchant identifier.
 *           example: "merch_xyz789"
 *         email:
 *           type: string
 *           nullable: true
 *           description: Primary email address associated with the merchant account.
 *           example: "admin@mybusiness.com"
 *         full_name:
 *           type: string
 *           nullable: true
 *           description: Full business or merchant name.
 *           example: "My Coffee Shop"
 *         phone_number:
 *           type: string
 *           nullable: true
 *           description: Merchant contact phone number.
 *           example: "+2348099887766"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the merchant account was created.
 *           example: "2025-12-01T08:00:00.000Z"
 *         facebook:
 *           type: string
 *           nullable: true
 *           description: Facebook profile or page URL.
 *           example: "https://facebook.com/mycoffeeshop"
 *         ig_handle:
 *           type: string
 *           nullable: true
 *           description: Instagram handle.
 *           example: "@mycoffeeshop"
 *         linked_in:
 *           type: string
 *           nullable: true
 *           description: LinkedIn profile URL.
 *         telegram:
 *           type: string
 *           nullable: true
 *           description: Telegram handle or group link.
 *         tiktok:
 *           type: string
 *           nullable: true
 *           description: TikTok handle.
 *         whatsapp:
 *           type: string
 *           nullable: true
 *           description: WhatsApp phone number or link.
 *         x_handle:
 *           type: string
 *           nullable: true
 *           description: X (formerly Twitter) handle.
 *         youtube:
 *           type: string
 *           nullable: true
 *           description: YouTube channel URL.
 *         snapchat:
 *           type: string
 *           nullable: true
 *           description: Snapchat handle.
 *         point_balance:
 *           type: number
 *           description: Your current merchant point pool balance. This is debited when customers earn points and credited when customers redeem points.
 *           example: 50000
 *         last_chance_email_countdown:
 *           type: integer
 *           nullable: true
 *           description: Number of days before point expiry to send a last-chance notification email to the customer.
 *           example: 7
 *         minimum_threshold_amount:
 *           type: number
 *           description: Minimum point balance a customer must have to be eligible for redemption.
 *           example: 100
 *         point_should_expire:
 *           type: boolean
 *           description: Whether customer points expire after a set period.
 *           example: true
 *         reactivation_email_countdown:
 *           type: integer
 *           nullable: true
 *           description: Number of days of customer inactivity before sending a re-engagement email.
 *           example: 30
 *         point_expiration_date:
 *           type: integer
 *           nullable: true
 *           description: Number of days after which customer points expire (only if `point_should_expire` is true).
 *           example: 365
 *         minimum_threshold_updated_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp of the last update to the minimum threshold amount.
 *         first_name:
 *           type: string
 *           nullable: true
 *           description: Merchant owner's first name.
 *           example: "Tolu"
 *         last_name:
 *           type: string
 *           nullable: true
 *           description: Merchant owner's last name.
 *           example: "Adeyemi"
 *         status:
 *           type: string
 *           description: Current status of the merchant account.
 *           example: "active"
 *         ip_whitelist:
 *           type: array
 *           items:
 *             type: string
 *           description: List of IP addresses allowed to access the API. An empty list means no IP restriction.
 *           example: ["203.0.113.50", "198.51.100.25"]
 *         webhook_url:
 *           type: string
 *           nullable: true
 *           description: URL where Rewrd sends webhook notifications for events like `points.earned` and `points.redeemed`.
 *           example: "https://mybusiness.com/webhooks/rewrd"
 *         webhook_secret:
 *           type: string
 *           nullable: true
 *           description: Secret used to sign webhook payloads so you can verify their authenticity.
 *           example: "whsec_abc123..."
 *
 *     EarningRule:
 *       type: object
 *       description: An earning rule defines how customers earn points. Rules are configured in the Rewrd dashboard and referenced by ID when crediting points.
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the earning rule.
 *           example: 42
 *         merchant_id:
 *           type: string
 *           description: The merchant this rule belongs to.
 *           example: "merch_xyz789"
 *         name:
 *           type: string
 *           description: Human-readable name for the earning rule (e.g. "Purchase Reward", "Signup Bonus").
 *           example: "Purchase Reward"
 *         points:
 *           type: number
 *           description: Number of points awarded when this rule is applied.
 *           example: 50
 *         type:
 *           type: string
 *           description: Category of the earning rule.
 *           example: "purchase"
 *         subtype:
 *           type: string
 *           nullable: true
 *           description: Sub-category for more granular rule classification.
 *         status:
 *           type: string
 *           description: Whether this rule is currently `active` or `inactive`.
 *           example: "active"
 *         users_rewarded:
 *           type: integer
 *           description: Total number of times this rule has been used to award points.
 *           example: 1523
 *         deleted:
 *           type: boolean
 *           description: Whether this rule has been soft-deleted.
 *           example: false
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the rule was created.
 *           example: "2026-01-01T00:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the last update to this rule.
 *         earning_type:
 *           type: string
 *           nullable: true
 *           description: Whether points are awarded as a `fixed` amount or `percentage_off` of a purchase.
 *           example: "fixed"
 *         percentage_off:
 *           type: number
 *           nullable: true
 *           description: Percentage value used when `earning_type` is `percentage_off`.
 *           example: 10
 *
 *     AnalyticsSummary:
 *       type: object
 *       description: Aggregated analytics for your loyalty program over a specified time period.
 *       properties:
 *         period:
 *           type: string
 *           description: The time period this data covers.
 *           example: "30d"
 *         total_earned:
 *           type: number
 *           description: Total points earned by all customers in this period.
 *           example: 25000
 *         total_redeemed:
 *           type: number
 *           description: Total points redeemed by all customers in this period.
 *           example: 8500
 *         active_customers:
 *           type: integer
 *           description: Number of customers who had at least one transaction in this period.
 *           example: 142
 *         total_points_balance:
 *           type: number
 *           description: Combined points balance across all customers.
 *           example: 175000
 *         total_transactions:
 *           type: integer
 *           description: Total number of point transactions (credits + redemptions) in this period.
 *           example: 854
 */

/**
 * @swagger
 * /merchant/config:
 *   get:
 *     summary: Get Merchant Configuration
 *     operationId: getMerchantConfig
 *     description: |
 *       Retrieves your current merchant configuration including profile information, social links, point expiry settings, webhook configuration, and security settings.
 *
 *       Use this endpoint to read your current settings before making updates.
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Merchant configuration retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Merchant configuration retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/MerchantConfig'
 *       401:
 *         description: Unauthorized — missing or invalid API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   patch:
 *     summary: Update Merchant Configuration
 *     operationId: updateMerchantConfig
 *     description: |
 *       Updates your merchant configuration. Only the fields included in the request body are updated; omitted fields remain unchanged.
 *
 *       Common use cases include updating the minimum redemption threshold, enabling point expiration, or updating social media links.
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minimum_threshold_amount:
 *                 type: number
 *                 description: Minimum point balance required for redemption.
 *                 example: 100
 *               point_should_expire:
 *                 type: boolean
 *                 description: Enable or disable point expiration.
 *                 example: true
 *               point_expiration_date:
 *                 type: integer
 *                 description: Number of days until points expire (only relevant if `point_should_expire` is true).
 *                 example: 365
 *               last_chance_email_countdown:
 *                 type: integer
 *                 description: Days before expiry to send a last-chance email.
 *                 example: 7
 *               reactivation_email_countdown:
 *                 type: integer
 *                 description: Days of inactivity before sending a re-engagement email.
 *                 example: 30
 *               facebook:
 *                 type: string
 *                 description: Facebook profile or page URL.
 *               ig_handle:
 *                 type: string
 *                 description: Instagram handle.
 *               linked_in:
 *                 type: string
 *                 description: LinkedIn profile URL.
 *               telegram:
 *                 type: string
 *                 description: Telegram handle or group link.
 *               tiktok:
 *                 type: string
 *                 description: TikTok handle.
 *               whatsapp:
 *                 type: string
 *                 description: WhatsApp phone number or link.
 *               x_handle:
 *                 type: string
 *                 description: X (formerly Twitter) handle.
 *               youtube:
 *                 type: string
 *                 description: YouTube channel URL.
 *               snapchat:
 *                 type: string
 *                 description: Snapchat handle.
 *     responses:
 *       200:
 *         description: Configuration updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Merchant configuration updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/MerchantConfig'
 *       400:
 *         description: Validation error — invalid field values.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized — missing or invalid API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/config", requireMerchant, getMerchantConfig);
router.patch("/config", requireMerchant, validateRequest(updateConfigSchema), updateMerchantConfig);

/**
 * @swagger
 * /merchant/rules:
 *   get:
 *     summary: List Earning Rules
 *     operationId: listEarningRules
 *     description: |
 *       Retrieves all active (non-deleted) earning rules for your merchant account.
 *
 *       Earning rules define how customers earn points. Each rule has a name, point value, and type. Use the rule `id` when crediting points via the [`POST /points/credit`](#/Points/creditPoints) endpoint to automatically associate the credit with the rule.
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Earning rules retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Earning rules retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EarningRule'
 *       401:
 *         description: Unauthorized — missing or invalid API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/rules", requireMerchant, getEarningRules);

/**
 * @swagger
 * /merchant/rules/{id}:
 *   get:
 *     summary: Get Earning Rule Details
 *     operationId: getEarningRule
 *     description: |
 *       Retrieves the details of a single earning rule by its ID, including usage statistics (`users_rewarded` count).
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the earning rule.
 *         example: 42
 *     responses:
 *       200:
 *         description: Earning rule details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Earning rule retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/EarningRule'
 *       404:
 *         description: Earning rule not found — no active rule exists with the given ID.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized — missing or invalid API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/rules/:id", requireMerchant, validateRequest(getRuleSchema), getEarningRule);

/**
 * @swagger
 * /merchant/security/ip-whitelist:
 *   get:
 *     summary: Get IP Whitelist
 *     operationId: getIpWhitelist
 *     description: |
 *       Retrieves the list of IP addresses that are currently whitelisted for API access.
 *
 *       When IP whitelisting is active (the list is non-empty), only requests originating from these IPs will be accepted. An empty list means all IPs are allowed.
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: IP whitelist retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   description: List of whitelisted IP addresses.
 *                   items:
 *                     type: string
 *                   example: ["203.0.113.50", "198.51.100.25"]
 *       401:
 *         description: Unauthorized — missing or invalid API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: Update IP Whitelist
 *     operationId: updateIpWhitelist
 *     description: |
 *       Replaces the entire IP whitelist with the provided list of IP addresses.
 *
 *       **Warning:** Setting an incorrect whitelist can lock you out of your API. Send an empty array `[]` to disable IP whitelisting and allow all IPs.
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ips
 *             properties:
 *               ips:
 *                 type: array
 *                 description: List of IP addresses to whitelist. Send an empty array to disable IP whitelisting.
 *                 items:
 *                   type: string
 *                 example: ["203.0.113.50", "198.51.100.25"]
 *     responses:
 *       200:
 *         description: IP whitelist updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "IP whitelist updated successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["203.0.113.50", "198.51.100.25"]
 *       400:
 *         description: Validation error — invalid IP addresses provided.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized — missing or invalid API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/security/ip-whitelist", requireMerchant, getIpWhitelist);
router.put("/security/ip-whitelist", requireMerchant, validateRequest(updateIpWhitelistSchema), updateIpWhitelist);

/**
 * @swagger
 * /merchant/analytics:
 *   get:
 *     summary: Get Merchant Analytics
 *     operationId: getMerchantAnalytics
 *     description: |
 *       Retrieves aggregated analytics for your loyalty program, filtered by time period.
 *
 *       The summary includes total points earned and redeemed, number of active customers, combined points balance, and total transaction count for the specified period.
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, 7d, 30d, all]
 *           default: all
 *         description: |
 *           Time period to aggregate analytics for:
 *           - `today` — current day only
 *           - `7d` — last 7 days
 *           - `30d` — last 30 days
 *           - `all` — all time (default)
 *         example: "30d"
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analytics retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/AnalyticsSummary'
 *       401:
 *         description: Unauthorized — missing or invalid API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/analytics", requireMerchant, validateRequest(getAnalyticsSchema), getAnalytics);

export default router;
