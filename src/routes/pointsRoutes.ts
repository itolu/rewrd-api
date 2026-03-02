import { Router } from "express";
import {
    creditPoints,
    redeemPoints,
    getCustomerTransactions
} from "../controllers/pointsController";
import { validateRequest } from "../middleware/validateRequest";
import { requireIdempotency } from "../middleware/idempotency";
import {
    creditPointsSchema,
    redeemPointsSchema,
    getTransactionsSchema
} from "../schema/pointsSchema";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PointsTransaction:
 *       type: object
 *       description: A ledger entry representing a points credit or redemption. Every point operation creates a transaction record.
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for this transaction.
 *           example: 1284
 *         merchant_id:
 *           type: string
 *           description: The merchant account this transaction belongs to.
 *           example: "merch_xyz789"
 *         customer_uid:
 *           type: string
 *           description: The customer who earned or redeemed points.
 *           example: "cust_abc123def456"
 *         amount:
 *           type: number
 *           description: Number of points in this transaction. Positive for credits, negative for redemptions.
 *           example: 50
 *         transaction_type:
 *           type: string
 *           description: |
 *             Type of transaction:
 *             - `member_points_adjustment_credit` — direct point credit
 *             - `member_purchase_order_earned_fixed` — points earned via a fixed earning rule
 *             - `member_purchase_order_earned_percentage` — points earned via a percentage earning rule
 *             - `member_purchase_order_redeemed` — points redeemed
 *           example: "member_points_adjustment_credit"
 *         reference_id:
 *           type: string
 *           description: Unique reference ID for this transaction, used for deduplication.
 *           example: "credit_a1b2c3d4-e5f6-7890"
 *         title:
 *           type: string
 *           description: Human-readable title for this transaction.
 *           example: "Points Credit"
 *         narration:
 *           type: string
 *           description: Optional description or note for this transaction.
 *           example: "Credited 50 points for purchase #12345"
 *         balance_after:
 *           type: number
 *           description: Customer's points balance after this transaction was applied.
 *           example: 1550
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when this transaction was created.
 *           example: "2026-02-20T14:30:00.000Z"
 */

/**
 * @swagger
 * /points/credit:
 *   post:
 *     summary: Credit Points to a Customer
 *     operationId: creditPoints
 *     description: |
 *       Awards loyalty points to a customer's account. The specified number of points is added to the customer's balance and deducted from your merchant point pool.
 *
 *       **Earning Rule Association (optional):**
 *       You can associate the credit with an earning rule by providing a `rule_id`. This links the transaction to the rule for analytics and automatically uses the rule's name and type in the transaction record. The rule must be `active` and not deleted.
 *
 *       **Webhooks:**
 *       A `points.earned` webhook event is fired after a successful credit, containing the `customer_uid`, `points`, `rule_id`, and `ledger_id`.
 *
 *       This endpoint requires an `Idempotency-Key` header to prevent duplicate credits.
 *     tags: [Points]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]{1,100}$'
 *         description: Unique key for idempotent request handling. Must be alphanumeric with hyphens or underscores, 1–100 characters.
 *         example: "credit-cust123-20260225-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_uid, points]
 *             properties:
 *               customer_uid:
 *                 type: string
 *                 description: The UID of the customer to credit points to.
 *                 example: "cust_abc123def456"
 *               points:
 *                 type: integer
 *                 description: Number of points to credit. Must be a positive integer.
 *                 example: 50
 *               rule_id:
 *                 type: integer
 *                 description: Optional ID of an earning rule to associate with this credit. The rule must be active.
 *                 example: 42
 *               narration:
 *                 type: string
 *                 description: Optional note or description for this transaction.
 *                 example: "Reward for purchase #12345"
 *               order_id:
 *                 type: string
 *                 description: Optional external order ID to link this credit to a specific purchase.
 *                 example: "order_98765"
 *     responses:
 *       200:
 *         description: Points credited successfully. Returns the created ledger entry.
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
 *                   example: "Points credited successfully"
 *                 data:
 *                   $ref: '#/components/schemas/PointsTransaction'
 *       400:
 *         description: Validation error — missing required fields or invalid values.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Customer or earning rule not found.
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
router.post("/credit", requireIdempotency, validateRequest(creditPointsSchema), creditPoints);

/**
 * @swagger
 * /points/redeem:
 *   post:
 *     summary: Redeem Points
 *     operationId: redeemPoints
 *     description: |
 *       Deducts loyalty points from a customer's account for a redemption. The specified number of points is subtracted from the customer's balance and added back to your merchant point pool.
 *
 *       **Balance checks:**
 *       - The customer must have sufficient points balance to cover the redemption.
 *       - The customer must meet the configured minimum threshold amount for redemption.
 *       - The customer must be in `active` status (not restricted).
 *
 *       **Webhooks:**
 *       A `points.redeemed` webhook event is fired after a successful redemption, containing the `customer_uid`, `points`, `reward_id`, and `ledger_id`.
 *
 *       This endpoint requires an `Idempotency-Key` header to prevent duplicate redemptions.
 *     tags: [Points]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]{1,100}$'
 *         description: Unique key for idempotent request handling. Must be alphanumeric with hyphens or underscores, 1–100 characters.
 *         example: "redeem-cust123-20260225-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_uid, points]
 *             properties:
 *               customer_uid:
 *                 type: string
 *                 description: The UID of the customer to redeem points from.
 *                 example: "cust_abc123def456"
 *               points:
 *                 type: integer
 *                 description: Number of points to redeem. Must be a positive integer and not exceed the customer's balance.
 *                 example: 200
 *               reward_id:
 *                 type: string
 *                 description: Optional ID of the reward being redeemed (for tracking purposes).
 *                 example: "reward_coffee_free"
 *               narration:
 *                 type: string
 *                 description: Optional note or description for this redemption.
 *                 example: "Redeemed for free coffee"
 *     responses:
 *       200:
 *         description: Points redeemed successfully. Returns the created ledger entry.
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
 *                   example: "Points redeemed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/PointsTransaction'
 *       400:
 *         description: Validation error or insufficient points balance.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Customer not found.
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
router.post("/redeem", requireIdempotency, validateRequest(redeemPointsSchema), redeemPoints);

/**
 * @swagger
 * /points/customers/{uid}/transactions:
 *   get:
 *     summary: Get Customer Transaction History
 *     operationId: getCustomerTransactions
 *     description: |
 *       Retrieves a paginated list of all point transactions (credits and redemptions) for a specific customer.
 *
 *       Transactions are sorted by date with the most recent first. Use this endpoint to display a customer's points activity history.
 *     tags: [Points]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the customer.
 *         example: "cust_abc123def456"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination (1-indexed).
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transactions to return per page.
 *         example: 20
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully.
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
 *                   example: "Transactions retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PointsTransaction'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       404:
 *         description: Customer not found.
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
router.get("/customers/:uid/transactions", validateRequest(getTransactionsSchema), getCustomerTransactions);

export default router;
