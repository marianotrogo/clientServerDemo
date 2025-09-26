import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
    name: {type: String, required: true},
    dni: {type: String},
    email: {type: String},
    phone: {type: String},
    credit: {type: Boolean, default: false},
    balance: {type: Number, default: 0},
}, {timestamps: true});

export default mongoose.model('Client', clientSchema)