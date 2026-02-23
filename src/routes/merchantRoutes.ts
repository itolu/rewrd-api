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
 *       properties:
 *         merchant_id:
 *           type: string
 *         email:
 *           type: string
 *           nullable: true
 *         full_name:
 *           type: string
 *           nullable: true
 *         phone_number:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         facebook:
 *           type: string
 *           nullable: true
 *         ig_handle:
 *           type: string
 *           nullable: true
 *         linked_in:
 *           type: string
 *           nullable: true
 *         telegram:
 *           type: string
 *           nullable: true
 *         tiktok:
 *           type: string
 *           nullable: true
 *         whatsapp:
 *           type: string
 *           nullable: true
 *         x_handle:
 *           type: string
 *           nullable: true
 *         youtube:
 *           type: string
 *           nullable: true
 *         snapchat:
 *           type: string
 *           nullable: true
 *         point_balance:
 *           type: number
 *         last_chance_email_countdown:
 *           type: integer
 *           nullable: true
 *         minimum_threshold_amount:
 *           type: number
 *         point_should_expire:
 *           type: boolean
 *         reactivation_email_countdown:
 *           type: integer
 *           nullable: true
 *         point_expiration_date:
 *           type: integer
 *           nullable: true
 *         minimum_threshold_updated_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         first_name:
 *           type: string
 *           nullable: true
 *         last_name:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *         ip_whitelist:
 *           type: array
 *           items:
 *             type: string
 *         webhook_url:
 *           type: string
 *           nullable: true
 *         webhook_secret:
 *           type: string
 *           nullable: true
 *     
 *     EarningRule:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         merchant_id:
 *           type: string
 *         name:
 *           type: string
 *         points:
 *           type: number
 *         type:
 *           type: string
 *         subtype:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *         users_rewarded:
 *           type: integer
 *         deleted:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         earning_type:
 *           type: string
 *           nullable: true
 *         percentage_off:
 *           type: number
 *           nullable: true
 *     
 *     AnalyticsSummary:
 *       type: object
 *       properties:
 *         period:
 *           type: string
 *         total_earned:
 *           type: number
 *         total_redeemed:
 *           type: number
 *         active_customers:
 *           type: integer
 *         total_points_balance:
 *           type: number
 *         total_transactions:
 *           type: integer
 */

/**
 * @swagger
 * tags:
 *   name: Merchant
 *   description: Merchant configuration and management
 */

/**
 * @swagger
 * /merchant/config:
 *   get:
 *     summary: Get Merchant Configuration
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Merchant configuration details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/MerchantConfig'
 *   patch:
 *     summary: Update Merchant Configuration
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
 *               point_should_expire:
 *                 type: boolean
 *               point_expiration_date:
 *                 type: integer
 *               last_chance_email_countdown:
 *                 type: integer
 *               reactivation_email_countdown:
 *                 type: integer
 *               facebook:
 *                 type: string
 *               ig_handle:
 *                 type: string
 *               linked_in:
 *                 type: string
 *               telegram:
 *                 type: string
 *               tiktok:
 *                 type: string
 *               whatsapp:
 *                 type: string
 *               x_handle:
 *                 type: string
 *               youtube:
 *                 type: string
 *               snapchat:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/MerchantConfig'
 */
router.get("/config", requireMerchant, getMerchantConfig);
router.patch("/config", requireMerchant, validateRequest(updateConfigSchema), updateMerchantConfig);

/**
 * @swagger
 * /merchant/rules:
 *   get:
 *     summary: List Earning Rules
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of active earning rules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EarningRule'
 */
router.get("/rules", requireMerchant, getEarningRules);

/**
 * @swagger
 * /merchant/rules/{id}:
 *   get:
 *     summary: Get Earning Rule Details
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Earning rule details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/EarningRule'
 *       404:
 *         description: Rule not found
 */
router.get("/rules/:id", requireMerchant, validateRequest(getRuleSchema), getEarningRule);

/**
 * @swagger
 * /merchant/security/ip-whitelist:
 *   get:
 *     summary: Get IP Whitelist
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of whitelisted IPs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *   put:
 *     summary: Update IP Whitelist
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
 *               ips:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: IP whitelist updated
 */
router.get("/security/ip-whitelist", requireMerchant, getIpWhitelist);
router.put("/security/ip-whitelist", requireMerchant, validateRequest(updateIpWhitelistSchema), updateIpWhitelist);

/**
 * @swagger
 * /merchant/analytics:
 *   get:
 *     summary: Get Merchant Analytics
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
 *     responses:
 *       200:
 *         description: Analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/AnalyticsSummary'
 */
router.get("/analytics", requireMerchant, validateRequest(getAnalyticsSchema), getAnalytics);

export default router;
