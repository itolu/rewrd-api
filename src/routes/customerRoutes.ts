import { Router } from "express";
import { validateRequest } from "../middleware/validateRequest";
import { createCustomerSchema, getCustomerSchema, listCustomersSchema, updateCustomerSchema } from "../schema/customerSchema";
import { createOrUpdateCustomer, getCustomer, listCustomers, updateCustomer, deleteCustomer } from "../controllers/customerController";

const router = Router();

router.post("/", validateRequest(createCustomerSchema), createOrUpdateCustomer);
router.get("/", validateRequest(listCustomersSchema), listCustomers);
router.get("/:uid", validateRequest(getCustomerSchema), getCustomer);
router.put("/:uid", validateRequest(updateCustomerSchema), updateCustomer);
router.delete("/:uid", validateRequest(getCustomerSchema), deleteCustomer); // Reusing get schema for delete (needs uid)

export default router;
