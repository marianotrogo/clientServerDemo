import mongoose from "mongoose";
import Client from "./Client.js"; // opcional si quieres hacer populate

const itemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    price: Number,
    qty: Number,
    total: Number
}, { _id: false })

// Sub-schema de pagos
const paymentSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    method: { 
        type: String, 
        enum: ['EFECTIVO', 'CREDITO', 'TRANSFERENCIA', 'QR', 'CUENTA_CORRIENTE', 'PAGOS_CUENTA_CORRIENTE'], 
        required: true 
    },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' } // solo si method === CUENTA_CORRIENTE
}, { _id: false });

const orderSchema = new mongoose.Schema({
    number: { type: String, unique: true },
    table: { type: String },
    address: { type: String },
    customerName: { type: String },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }, // vinculo al cliente
    items: [itemSchema],
    subtotal: Number,
    discount: { type: Number, default: 0 },
    surcharge: { type: Number, default: 0 },
    total: Number,
    payments: [paymentSchema], // pagos múltiples
    status: {
        type: String,
        enum: ['PROCESO', 'ENVIADO', 'COBRADO', 'CANCELADO', 'CUENTA_CORRIENTE'],
        default: 'PROCESO'
    },
    paidAt: { type: Date },    
    cancelReason: { type: String, default: '' },
    canceledAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
