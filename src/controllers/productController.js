import Product from "../models/Product.js";
import Category from "../models/Category.js";


export const list = async (_req, res) => {
    const items = await Product.find({ active: true })
        .sort({ name: 1 })
        .populate('category', 'name')
    res.json(items)
}
export const create = async (req, res) => {

    if (req.body.category) {
        const exists = await Category.exists({ _id: req.body.category, active: true });
        if (!exists) return res.status(400).json({ message: 'Categoria invalida o inactiva' })
    }
    const p = await Product.create(req.body)
    res.status(201).json(p)
}

export const update = async (req, res) => {
    if(req.body.category){
        const exists = await Category.exists({_id: req.body.category, active: true});
        if(!exists) return res.status(400).json({message: 'Categoria invaldia o inactiva'})
    }
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json(p)
}

export const remove = async (req, res) => {
    await Product.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
}