import { v4 as uuidv4 } from 'uuid'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Client from '../models/Client.js'
import { buildTicket } from '../utils/ticket.js'
import { io } from '../server.js'

// Utilidad para convertir "YYYY-MM-DD" en rango del día local
const makeDayRange = (dStr) => {
  if (!dStr) return null
  const parts = dStr.split('-') // espera "YYYY-MM-DD"
  if (parts.length !== 3) return null
  const [y, m, day] = parts.map(Number)
  if (!y || !m || !day) return null
  const start = new Date(y, m - 1, day, 0, 0, 0, 0)
  const end = new Date(y, m - 1, day, 23, 59, 59, 999)
  return { start, end }
}

export const createOrder = async (req, res) => {
  try {
    const { items, table, customerName, address, discount = 0, surcharge = 0, client, payments } = req.body
    if (!items?.length) return res.status(400).json({ message: "No items" })

    const fullItems = []
    let subtotal = 0

    for (const it of items) {
      const p = await Product.findById(it.productId)
      if (!p) return res.status(400).json({ message: `Product not found: ${it.productId}` })
      const qty = it.qty || it.quantity || 1

      if (p.stock < qty) {
        return res.status(400).json({ message: `Not enough stock for product: ${p.name}` })
      }

      p.stock -= qty
      await p.save()

      const total = p.price * qty
      subtotal += total
      fullItems.push({ product: p._id, name: p.name, price: p.price, qty, total })
    }

    const total = subtotal - discount + surcharge

    const lastOrder = await Order.findOne().sort({ createdAt: -1 })
    let nextNumber = 1
    if (lastOrder?.number) {
      const parsed = parseInt(lastOrder.number, 10)
      if (!isNaN(parsed)) nextNumber = parsed + 1
    }
    const paddedNumber = String(nextNumber).padStart(5, "0")

    // Normalizar cliente
    let clientId = null
    if (client) {
      if (typeof client === 'string') clientId = client
      else if (typeof client === 'object' && client._id) clientId = client._id
    }
    if (!clientId && customerName) {
      const existingClient = await Client.findOne({ name: customerName }).select('_id')
      if (existingClient) clientId = existingClient._id
    }

    // 🔹 Manejo de pagos y estado CUENTA_CORRIENTE
    let orderStatus = "PROCESO"
    let normalizedPayments = []

    if (Array.isArray(payments) && payments.length > 0) {
      normalizedPayments = payments.map(p => ({
        method: (p.method || '').toUpperCase(),
        amount: Number(p.amount) || 0,
        client: p.client ? (typeof p.client === 'object' ? p.client._id : p.client) : null
      }))

      const ccPayment = normalizedPayments.find(p => p.method === 'CUENTA_CORRIENTE')
      if (ccPayment) {
        if (!ccPayment.client) return res.status(400).json({ message: 'Falta cliente para cuenta corriente' })
        orderStatus = "CUENTA_CORRIENTE"

        // Incrementar saldo del cliente (deuda)
        await Client.findByIdAndUpdate(
          ccPayment.client,
          { $inc: { balance: total } }, // total del pedido como deuda
          { new: true }
        )

        // No se considera pago aún, se limpia el array
        normalizedPayments = []
      }
    }

    const order = await Order.create({
      number: paddedNumber,
      table,
      customerName,
      address,
      client: clientId || null,
      items: fullItems,
      subtotal,
      discount,
      surcharge,
      total,
      status: orderStatus,
      payments: normalizedPayments,
      createdBy: req.user?.id
    })

    const orderToReturn = clientId ? await Order.findById(order._id).populate('client', 'name email phone') : order

    io.emit("new-order", orderToReturn)

    res.status(201).json(orderToReturn)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
}



export const printTicket = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    const business = {
      name: process.env.BUSINESS_NAME || 'Mi restaurante',
      address: process.env.BUSSINES_ADDRESS || '',
      tel: process.env.BUSINESS_TEL || '',
      footer: process.env.TICKET_FOOTER || ''
    }
    const doc = buildTicket({ business, order })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename=ticket-${order.number}.pdf`)
    doc.pipe(res)

  } catch (e) { res.status(500).json({ message: e.message }) }
}

export const salesByDate = async (req, res) => {
  const { from, to } = req.query
  const match = {}
  if (from || to) {
    match.createdAt = {}
    if (from) {
      const r = makeDayRange(from)
      match.createdAt.$gte = r ? r.start : new Date(from)
    }
    if (to) {
      const r = makeDayRange(to)
      match.createdAt.$lte = r ? r.end : new Date(to)
    }
  }
  const data = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$total' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ])
  res.json(data.map(d => ({ date: d._id, total: d.total, count: d.count })))
}

export const dashboardReport = async (req, res) => {
  try {
    const { from, to, date, code } = req.query;

    const noFilters = !from && !to && !date;
    if (noFilters) {
      return res.json({
        totalSales: 0,
        totalOrders: 0,
        payments: {},
        cuentaCorrienteTotal: 0,
        cuentaCorrienteCount: 0,
        categories: [],
        byDay: []
      });
    }

    // ⚡ NUEVO: si hay rango manual (from/to) exigir código
    if ((from || to) && !date) {
      if (!code || code !== process.env.REPORT_ACCESS_CODE) {
        return res.status(403).json({ message: "Código de acceso inválido" });
      }
    }

    // 🔹 Rango de fechas
    const makeMatchDates = (field = 'createdAt') => {
      const match = {};
      if (date) {
        const r = makeDayRange(date);
        if (r) match[field] = { $gte: r.start, $lte: r.end };
      } else if (from || to) {
        match[field] = {};
        if (from) {
          const r = makeDayRange(from);
          match[field].$gte = r ? r.start : new Date(from);
        }
        if (to) {
          const r = makeDayRange(to);
          match[field].$lte = r ? r.end : new Date(to);
        }
      }
      return match;
    };

    const matchCreated = makeMatchDates('createdAt');
    const matchPaid = makeMatchDates('paidAt')

    // 🔹 Totales generales (solo cobradas)
    const totals = await Order.aggregate([
      { $match: { status: 'COBRADO', ...matchPaid } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    // 🔹 Subtotales por método de pago (solo cobradas)
    const paymentsAgg = await Order.aggregate([
      { $match: { status: 'COBRADO', ...matchPaid } },
      { $unwind: '$payments' },
      {
        $group: {
          _id: '$payments.method',
          total: { $sum: '$payments.amount' }
        }
      }
    ]);

    const payments = paymentsAgg.reduce((acc, p) => {
      acc[p._id] = p.total;
      return acc;
    }, {});

    // 🔹 Pagos a cuenta corriente cobrados
    const ccPaidAgg = await Order.aggregate([
      { $match: { status: 'COBRADO', ...matchCreated } },
      { $unwind: '$payments' },
      { $match: { 'payments.method': 'PAGO_CUENTA_CORRIENTE' } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } }
    ]);
    payments['PAGO_CUENTA_CORRIENTE'] = ccPaidAgg[0]?.total || 0;

    // 🔹 Pedidos pendientes en cuenta corriente (no cobrados)
    const ccPendingAgg = await Order.aggregate([
      { $match: { status: 'CUENTA_CORRIENTE', ...matchCreated } },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);
    const cuentaCorrienteTotal = ccPendingAgg[0]?.total || 0;
    const cuentaCorrienteCount = ccPendingAgg[0]?.count || 0;

    // 🔹 Ventas por categorías (solo cobradas)
    const categories = await Order.aggregate([
      { $match: { status: 'COBRADO', ...matchPaid } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'productInfo.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$categoryInfo.name', 'Sin categoría'] },
          total: { $sum: '$items.total' }
        }
      }
    ]);

    // 🔹 Evolución diaria (solo cobradas)
    const byDay = await Order.aggregate([
      { $match: { status: 'COBRADO', ...matchPaid } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalSales: totals[0]?.totalSales || 0,
      totalOrders: totals[0]?.totalOrders || 0,
      payments,
      cuentaCorrienteTotal,
      cuentaCorrienteCount,
      categories: categories.map(c => ({ category: c._id, total: c.total })),
      byDay: byDay.map(d => ({ date: d._id, total: d.total, count: d.count }))
    });

  } catch (e) {
    console.error('Error dashboardReport:', e);
    res.status(500).json({ message: e.message });
  }
};


// Listado de tickets para reimprimir
export const listTickets = async (req, res) => {
  try {
    const { from, date } = req.query
    const match = { status: 'COBRADO' }

    if (date) {
      const r = makeDayRange(date)
      if (r) match.createdAt = { $gte: r.start, $lte: r.end }
    } else if (from) {
      const r = makeDayRange(from)
      if (r) match.createdAt = { $gte: r.start, $lte: r.end }
    }

    const tickets = await Order.find(match)
      .sort({ createdAt: -1 })
      .select('number createdAt address customerName total paymentMethod')

    res.json(Array.isArray(tickets) ? tickets : [])
  } catch (e) {
    console.error('Error listTickets:', e)
    res.status(500).json({ message: e.message })
  }
}

// Cambiar estado de un pedido
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { action } = req.body  // 'enviar', 'cobrar', 'cancelar'

    const order = await Order.findById(id)
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' })

    switch (action) {
      case 'enviar':
        if (order.status === 'PROCESO') {
          order.status = 'ENVIADO'
        } else {
          return res.status(400).json({ message: 'Solo se puede enviar desde PROCESO' })
        }
        break

      case 'cobrar':
        if (!['PROCESO', 'ENVIADO', 'CUENTA_CORRIENTE'].includes(order.status)) {
          return res.status(400).json({ message: 'Solo se puede cobrar desde PROCESO, ENVIADO o CUENTA_CORRIENTE' });
        }

        const payments = req.body.payments;
        if (!Array.isArray(payments) || payments.length === 0) {
          return res.status(400).json({ message: 'Se requieren pagos' });
        }

        const normalizedPayments = payments.map(p => ({
          method: (p.method || '').toUpperCase(),
          amount: Number(p.amount) || 0,
          client: p.client ? (typeof p.client === 'object' ? p.client._id : p.client) : null
        }));

        const totalPaid = normalizedPayments.reduce((sum, p) => sum + p.amount, 0);

        if (normalizedPayments.length === 1 && normalizedPayments[0].method === 'CUENTA_CORRIENTE') {
          const p = normalizedPayments[0];
          if (!p.client) return res.status(400).json({ message: 'Falta cliente para cuenta corriente' });

          await Client.findByIdAndUpdate(p.client, { $inc: { balance: order.total } });

          order.status = 'CUENTA_CORRIENTE';
          order.paidAmount = 0;
          order.payments = [];
          order.paymentMethod = 'CUENTA_CORRIENTE';

        } else {
          order.payments = [...(order.payments || []), ...normalizedPayments];
          order.paidAmount = (order.paidAmount || 0) + totalPaid;

          for (const p of normalizedPayments.filter(p => p.method === 'CUENTA_CORRIENTE')) {
            if (!p.client) return res.status(400).json({ message: 'Falta cliente para cuenta corriente' });
            await Client.findByIdAndUpdate(p.client, { $inc: { balance: -p.amount } });
          }

          if (order.paidAmount >= order.total) {
            order.status = 'COBRADO';
            order.paidAt = new Date();
          } else if (order.status !== 'CUENTA_CORRIENTE') {
            order.status = 'PROCESO';
          }

          order.paymentMethod = normalizedPayments.map(p =>
            p.method === 'CUENTA_CORRIENTE' ? `CUENTA_CORRIENTE(${p.client})` : p.method
          ).join(' + ');
        }
        break;


      case 'cancelar':
        if (order.status !== 'COBRADO') {
          order.status = 'CANCELADO'
          order.cancelReason = req.body.description || ''
          order.canceledAt = new Date()
        } else {
          return res.status(400).json({ message: 'No se puede cancelar un pedido ya cobrado' })
        }
        break

      default:
        return res.status(400).json({ message: 'Acción no válida' })
    }

    await order.save()
    io.emit("orderUpdated", order)
    res.json(order)
  } catch (e) {
    console.error('Error updateOrderStatus:', e)
    res.status(500).json({ message: e.message })
  }
}



export const listOrdersAll = async (req, res) => {
  try {
    const orders = await Order.find({ status: { $in: ['PROCESO', 'ENVIADO'] } })
      .populate('client', '_id name')
      .sort({ createdAt: -1 })
    res.json(orders)
  } catch (e) {
    console.error('Error listOrdersAll:', e)
    res.status(500).json({ message: e.message })
  }
}


export const listCanceledOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: 'CANCELADO' })
      .sort({ canceledAt: -1 })
    res.json(orders)
  } catch (e) {
    console.error('Error listcacleederordes:', e)
    res.status(500).json({ message: e.message })
  }
}

