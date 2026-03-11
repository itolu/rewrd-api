import { Router } from "express";
import {
    processPointsTransaction,
    getCustomerTransactions
} from "../controllers/pointsController";
import { validateRequest } from "../middleware/validateRequest";
import { requireIdempotency } from "../middleware/idempotency";
import { requireCustomer } from "../middleware/requireCustomer";
import {
    transactionSchema,
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
 *         customer_uid:
 *           type: string
 *           description: The customer who earned or redeemed points.
 *           example: "26833813"
 *         points:
 *           type: number
 *           description: Number of points in this transaction.
 *           example: 50
 *         title:
 *           type: string
 *           description: Human-readable title for this transaction.
 *           example: "Points Credit"
 *         narration:
 *           type: string
 *           description: Optional description or note for this transaction.
 *           example: "Credited 50 points for purchase #12345"
 *         transaction_type:
 *           type: string
 *           description: |
 *             Type of transaction:
 *             - `member_points_adjustment_credit` — direct point credit
 *             - `member_purchase_order_earned_fixed` — points earned via a fixed earning rule
 *             - `member_purchase_order_earned_percentage` — points earned via a percentage earning rule
 *             - `member_purchase_order_redeemed` — points redeemed
 *           example: "member_points_adjustment_credit"
 *         ledger_type:
 *           type: string
 *           description: Generic type of ledger entry (credit or debit).
 *           example: "credit"
 *         status:
 *           type: string
 *           description: Status of the transaction.
 *           example: "successful"
 *         reference_id:
 *           type: string
 *           description: Unique reference ID for this transaction, used for deduplication.
 *           example: "credit_a1b2c3d4-e5f6-7890"
 *         balance_before:
 *           type: number
 *           description: Customer's points balance before this transaction was applied.
 *           example: 1500
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
 * /points/transaction:
 *   post:
 *     summary: Process a Unified Points Transaction
 *     operationId: processPointsTransaction
 *     description: |
 *       Process a points transaction for a customer. This single endpoint handles three scenarios:
 *
 *       **How it works:**
 *       Use the `reward` and `redeem` boolean flags to tell Rewrd what type of transaction to perform. You can set one or both to `true`.
 *
 *       | `reward` | `redeem` | What happens |
 *       |---|---|---|
 *       | `true` | `false` | **Reward only** — Customer earns points based on an earning rule. |
 *       | `false` | `true` | **Redeem only** — Customer spends points toward a purchase. |
 *       | `true` | `true` | **Combined** — Customer earns AND redeems points in a single checkout. |
 *
 *       ---
 *
 *       **When `reward` is `true`:**
 *       You must provide `way_to_earn_id` (the ID of the earning rule from your dashboard). Rewrd will calculate the points to credit based on the rule's type:
 *       - **Fixed rule** — Awards a fixed number of points regardless of `order_value` (e.g. always award 50 points).
 *       - **Percentage rule** — Awards points as a percentage of `order_value` (e.g. 10% of ₦5,000 = 500 points).
 *
 *       **When `redeem` is `true`:**
 *       You must provide `deduct_points` — the exact number of points to deduct from the customer's balance. The customer must have enough points, otherwise the request will fail with an `insufficient_points` error.
 *
 *       ---
 *
 *       **Real-world example — Combined checkout:**
 *       A customer buys a coffee for ₦5,000. They want to use 200 of their points AND earn new points for the purchase:
 *       ```json
 *       {
 *         "customer_uid": "cust_abc123",
 *         "order_id": "ORD-003",
 *         "order_value": 5000,
 *         "redeem": true,
 *         "deduct_points": 200,
 *         "reward": true,
 *         "way_to_earn_id": 1
 *       }
 *       ```
 *       This will deduct 200 points AND credit new points based on earning rule #1, all in a single atomic operation.
 *
 *       ---
 *
 *       This endpoint requires an `Idempotency-Key` header to prevent duplicate transactions. Use a unique key per checkout (e.g. your order ID).
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
 *         example: "tx-cust123-20260225-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_uid, order_id, order_value, redeem, reward]
 *             properties:
 *               customer_uid:
 *                 type: string
 *                 description: The UID of the customer making the checkout.
 *                 example: "cust_abc123"
 *               order_id:
 *                 type: string
 *                 description: External order ID tying this points usage to a checkout basket.
 *                 example: "ORD-003"
 *               order_value:
 *                 type: number
 *                 description: The fiat value of the items in the total basket.
 *                 example: 10000
 *               redeem:
 *                 type: boolean
 *                 description: True if the customer is choosing to deduct points towards the purchase.
 *                 example: true
 *               reward:
 *                 type: boolean
 *                 description: True if the order creates an earning opportunity.
 *                 example: true
 *               deduct_points:
 *                 type: integer
 *                 description: Quantity of points exactly to be removed (required if redeem is true).
 *                 example: 200
 *               way_to_earn_id:
 *                 type: integer
 *                 description: Pre-configured loyalty mechanism integer rule (required if reward is true).
 *                 example: 1
 *     responses:
 *       200:
 *         description: Transaction executed properly.
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
 *                   example: "Transaction processed successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PointsTransaction'
 *       400:
 *         description: Validation error — missing required condition triggers.
 *       404:
 *         description: Customer or earning rule not found.
 *       401:
 *         description: Unauthorized — missing or invalid API key.
 */
router.post("/transaction", requireIdempotency, validateRequest(transactionSchema), requireCustomer, processPointsTransaction);

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
 *
 *       **Understanding the response fields:**
 *
 *       **`ledger_type`** tells you the direction of the transaction:
 *       - `credit` — Points were **added** to the customer's balance
 *       - `debit` — Points were **deducted** from the customer's balance
 *
 *       **`transaction_type`** tells you *how* the points were earned or spent:
 *       | Transaction Type | Meaning |
 *       |---|---|
 *       | `member_points_adjustment_credit` | Points were directly credited (manual adjustment) |
 *       | `member_purchase_order_earned_fixed` | Points earned via a **fixed** earning rule (e.g. "earn 50 points per purchase") |
 *       | `member_purchase_order_earned_percentage` | Points earned via a **percentage** earning rule (e.g. "earn 10% of order value as points") |
 *       | `member_purchase_order_redeemed` | Points were redeemed (spent) toward a purchase |
 *
 *       **`balance_before`** and **`balance_after`** show the customer's points balance before and after the transaction, so you can verify the math.
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
 *         example: "26833813"
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
router.get("/customers/:uid/transactions", validateRequest(getTransactionsSchema), requireCustomer, getCustomerTransactions);

export default router;
