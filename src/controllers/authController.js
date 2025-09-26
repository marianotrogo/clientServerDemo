import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body

        //Verifica si el usuario ya existe
        const exist = await User.findOne({ email })
        if (exist) return res.status(400).json({ message: 'User exists' })

        //Hashea la contraseña    
        const passwordHash = await bcrypt.hash(password, 10)

        //Crear usuario
        const user = await User.create({ name, email, passwordHash, role })

        const token = jwt.sign(
            { id: user._id, role: user.role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '7d' }

        )

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                email: user.email
            }
        })
    } catch (e) { res.status(500).json({ message: e.message }) }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        //Buscar Usuario
        const user = await User.findOne({ email })
        if (!user) return res.status(401).json({ message: 'Invalid credentials' })

        //Validamos la contraseña
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });

        //Generamos el token
        const token = jwt.sign(
            { id: user._id, role: user.role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                email: user.email
            }
        });

    } catch (e) { res.status(500).json({ message: e.message }) }
}

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body
        const user = await User.findOne({ email })
        if (!user) return res.status(404).json({ message: 'User not found' })

        const resetToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        )

        // En producción enviar por email
        // Para pruebas devolvemos el token
        res.json({ message: 'Token generated', resetToken })
    } catch (e) {
        res.status(500).json({ message: e.message })
    }
}


export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body
        if (!token || !newPassword) return res.status(400).json({ message: 'Missing data' })

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(decoded.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        user.passwordHash = await bcrypt.hash(newPassword, 10)
        await user.save()

        res.json({ message: 'Password updated successfully' })
    } catch (e) {
        res.status(500).json({ message: e.message })
    }
}
