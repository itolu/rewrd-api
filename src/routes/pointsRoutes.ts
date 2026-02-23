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
 * tags:
 *   name: Points
 *   description: Points management
 */

/**
 * @swagger
 * /points/credit:
 *   post:
 *     summary: Credit points to a customer
 *     tags: [Points]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
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
 *               points:
 *                 type: integer
 *               rule_id:
 *                 type: integer
 *                 description: Optional earning rule ID to associate
 *               narration:
 *                 type: string
 *               order_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Points credited successfully
 */
router.post("/credit", requireIdempotency, validateRequest(creditPointsSchema), creditPoints);

/**
 * @swagger
 * /points/redeem:
 *   post:
 *     summary: Redeem points
 *     tags: [Points]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
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
 *               points:
 *                 type: integer
 *               reward_id:
 *                 type: string
 *               narration:
 *                 type: string
 *     responses:
 *       200:
 *         description: Points redeemed successfully
 */
router.post("/redeem", requireIdempotency, validateRequest(redeemPointsSchema), redeemPoints);

/**
 * @swagger
 * /points/customers/{uid}/transactions:
 *   get:
 *     summary: Get customer transaction history
 *     tags: [Points]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 */
router.get("/customers/:uid/transactions", validateRequest(getTransactionsSchema), getCustomerTransactions);

export default router;
