import bcrypt from 'bcrypt';
import User from '../models/User.js';

// Obtener todos los usuarios
export const getUsers = async (_req, res) => {
  try {
    const users = await User.find().select('-passwordHash');
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Editar usuario / activar-desactivar
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, active } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (active !== undefined) user.active = active;

    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({ 
      message: 'User updated', 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        active: user.active 
      } 
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Borrado lógico (poner active = false)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.active = false; // borrado lógico
    await user.save();

    res.json({ message: 'User deactivated', user: { id: user._id, active: user.active } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
