import { Router } from "express";
import { requireIdempotency } from "../middleware/idempotency";
import { requireCustomer } from "../middleware/requireCustomer";
import { validateRequest } from "../middleware/validateRequest";
import { createCustomerSchema, getCustomerSchema, listCustomersSchema, updateCustomerSchema } from "../schema/customerSchema";
import { createOrUpdateCustomer, getCustomer, listCustomers, updateCustomer, deleteCustomer } from "../controllers/customerController";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       required:
 *         - phone_number
 *       properties:
 *         uid:
 *           type: string
 *           description: Unique Customer ID
 *         email:
 *           type: string
 *           format: email
 *         phone_number:
 *           type: string
 *         name:
 *           type: string
 *         first_name:
 *           type: string
 *         last_name:
 *           type: string
 *         date_of_birth:
 *           type: string
 *           format: date
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management API
 */

/**
 * @swagger
 * /customers:
 *   post:
 *     summary: Create or Update a Customer
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]{1,100}$'
 *         description: Unique key for idempotent request handling (alphanumeric, hyphens, underscores, 1-100 chars)
 *         example: "customer-create-20260203-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone_number
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phone_number:
 *                 type: string
 *               name:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Customer created or updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Validation error or missing/invalid Idempotency-Key
 *       401:
 *         description: Unauthorized
 */
router.post("/", requireIdempotency, validateRequest(createCustomerSchema), createOrUpdateCustomer);

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: List Customers
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of items per page
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Filter by email
 *       - in: query
 *         name: phone_number
 *         schema:
 *           type: string
 *         description: Filter by phone number
 *     responses:
 *       200:
 *         description: List of customers
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
 *                     $ref: '#/components/schemas/Customer'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get("/", validateRequest(listCustomersSchema), listCustomers);

/**
 * @swagger
 * /customers/{uid}:
 *   get:
 *     summary: Get a Customer by UID
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer UID
 *     responses:
 *       200:
 *         description: Customer details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 */
router.get("/:uid", validateRequest(getCustomerSchema), requireCustomer, getCustomer);

/**
 * @swagger
 * /customers/{uid}:
 *   put:
 *     summary: Update a Customer
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               name:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 */
router.put("/:uid", validateRequest(updateCustomerSchema), requireCustomer, updateCustomer);

/**
 * @swagger
 * /customers/{uid}:
 *   delete:
 *     summary: Deactivate a Customer
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer UID
 *     responses:
 *       200:
 *         description: Customer deactivated successfully
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/:uid", validateRequest(getCustomerSchema), requireCustomer, deleteCustomer); // Reusing get schema for delete (needs uid)

export default router;