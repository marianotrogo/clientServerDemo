import Client from "../models/Client.js";
import Order from "../models/Order.js";
import { io } from "../server.js";

// Crear cliente
export const createClient = async (req, res) => {
  try {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Listar clientes
export const listClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Buscar clientes por nombre o DNI
export const searchClients = async (req, res) => {
  try {
    const { query } = req.query;
    const clients = await Client.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { dni: { $regex: query, $options: "i" } }
      ]
    }).limit(10);
    res.json(clients);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};


// Actualizar cliente
export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByIdAndUpdate(id, req.body, { new: true });

    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json(client);
  } catch (e) {
    console.error("Error al actualizar cliente:", e);
    res.status(500).json({ message: e.message });
  }
};


// Eliminar cliente con Mongoose
export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByIdAndDelete(id);

    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json({ message: "Cliente eliminado correctamente" });
  } catch (e) {
    console.error("Error al eliminar cliente:", e);
    res.status(500).json({ message: e.message });
  }
};


export const payClientBalance = async (req, res) => {
  try {
    const { id } = req.params; // id del cliente
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: "Monto inválido" });
    }

    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    if (!client.balance || client.balance < Number(amount)) {
      return res.status(400).json({ message: "Saldo insuficiente" });
    }

    // Restar el monto del saldo del cliente
    client.balance -= Number(amount);
    await client.save();

    // 🔹 Registrar ingreso como "CREDITO" (enum válido)
    const lastOrder = await Order.findOne().sort({ createdAt: -1 });
    let nextNumber = 1;
    if (lastOrder?.number) {
      const parsed = parseInt(lastOrder.number, 10);
      if (!isNaN(parsed)) nextNumber = parsed + 1;
    }
    const paddedNumber = String(nextNumber).padStart(5, "0");

    const order = await Order.create({
      number: paddedNumber,
      table: null,
      customerName: client.name,
      client: client._id,
      items: [], // ningún producto, solo registro de pago
      subtotal: Number(amount),
      discount: 0,
      surcharge: 0,
      total: Number(amount),
      status: "COBRADO",
      payments: [
        { method: "CREDITO", amount: Number(amount), client: client._id } // enum válido
      ],
      paidAt: new Date(),
      createdBy: null
    });

    io.emit("new-order", order);

    res.json({
      message: `Se registró un pago de $${amount} para ${client.name}`,
      client,
      order
    });
  } catch (e) {
    console.error("Error en payClientBalance:", e);
    res.status(500).json({ message: e.message });
  }
};
