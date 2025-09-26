import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from './src/models/User.js'; // ajustá la ruta según tu proyecto

dotenv.config();

const run = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Datos del usuario
    const name = 'Admin';
    const email = 'admin@demo.com';
    const password = 'admin123';
    const role = 'ADMIN';

    // Crear hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario en DB
    const user = await User.create({ name, email, passwordHash, role });
    console.log('Usuario creado:', user);

    mongoose.disconnect();
  } catch (e) {
    console.error(e);
  }
};

run();
