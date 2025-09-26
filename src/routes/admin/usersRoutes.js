import { Router } from 'express'
import { authRequired, requireRole } from '../../middleware/auth.js'
import { getUsers, updateUser, deleteUser } from '../../controllers/adminUsersController.js'

const router = Router()

// obtener todos los usuarios
router.get('/', authRequired, requireRole('ADMIN'), getUsers)

// actualizar usuario (PUT /api/admin/users/:id)
router.put('/:id', authRequired, requireRole('ADMIN'), updateUser)

// borrado lógico (DELETE /api/admin/users/:id)
router.delete('/:id', authRequired, requireRole('ADMIN'), deleteUser)

export default router
