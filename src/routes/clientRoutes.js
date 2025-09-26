import express from 'express'
import {
    createClient,
    deleteClient,
    listClients,
    payClientBalance,
    searchClients,
    updateClient,
} from '../controllers/clientController.js'

const router = express.Router();

router.post('/', createClient)
router.get('/', listClients)
router.get('/search', searchClients)
router.put('/:id', updateClient)
router.delete('/:id', deleteClient)
router.patch('/:id/pay', payClientBalance)

export default router;