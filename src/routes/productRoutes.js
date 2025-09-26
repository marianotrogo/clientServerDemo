import { Router } from "express";
import { authRequired,requireRole } from "../middleware/auth.js";
import {list, create, update, remove} from '../controllers/productController.js';

const router = Router()

router.get('/', authRequired, list)
router.post('/', authRequired, requireRole('ADMIN'), create)
router.put('/:id', authRequired, requireRole('ADMIN'), update)
router.delete('/:id', authRequired, requireRole('ADMIN'), remove)

export default router

