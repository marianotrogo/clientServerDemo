import {Router} from 'express';
import {login, register, forgotPassword, resetPassword} from '../controllers/authController.js';
import { authRequired, requireRole} from '../middleware/auth.js';

const router = Router();

router.post('/register', authRequired, requireRole('ADMIN'), register)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)


export default router