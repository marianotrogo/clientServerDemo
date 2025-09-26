import Category from "../models/Category.js";
import Product from "../models/Product.js";

export const list = async (_req, res) => {
  const items = await Category.find({ active: true }).sort({ name: 1 });
  res.json(items);
};

export const create = async (req, res) => {
  const c = await Category.create(req.body); // { name, active? }
  res.status(201).json(c);
};

export const update = async (req, res) => {
  const c = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(c);
};

export const remove = async (req, res) => {
  // Evitar borrar si hay productos que usan esta categoría
  const inUse = await Product.countDocuments({ category: req.params.id });
  if (inUse > 0) {
    return res.status(400).json({ message: "No se puede eliminar: la categoría está en uso por productos." });
  }
  await Category.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
};
