import {Router} from 'express'
import { authRequired } from '../middleware/auth.js'
import {createOrder, 
    dashboardReport, 
    printTicket, 
    salesByDate, 
    listTickets, 
    listOrdersAll, 
    updateOrderStatus,
    listCanceledOrders} from '../controllers/orderController.js'

const router = Router();

router.patch('/:id/status', authRequired, updateOrderStatus)

router.get('/', authRequired, listOrdersAll)
router.post('/', authRequired, createOrder)

router.get('/reports/sales-by-date', authRequired, salesByDate)
router.get('/reports/dashboard', authRequired, dashboardReport);

router.get('/canceled', authRequired, listCanceledOrders)

router.get('/tickets', authRequired, listTickets)
router.get('/:id/ticket', authRequired, printTicket)

export default router