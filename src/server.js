import 'dotenv/config.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { connectDB } from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import adminUsersRoutes from './routes/admin/usersRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import clientRoutes from './routes/clientRoutes.js'
import { createServer } from 'http'
import { Server } from 'socket.io'



// ✅ Definir primero los orígenes permitidos
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5174', 'https://tusitio.vercel.app'];

const app = express()
const httpServer = createServer(app)

// ✅ Socket.IO con CORS configurado correctamente
export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});


app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS not allowed for this origin'))
    }
  },
  credentials: true,
}));

app.use(cookieParser())
app.use(express.json())
app.use(morgan('dev'))

// ✅ Rutas
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin/users', adminUsersRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/clients', clientRoutes)

// ✅ Ruta de verificación
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ✅ Arranque del servidor
const port = process.env.PORT || 5000
connectDB().then(() => {
  httpServer.listen(port, () => console.log(`API listening on: ${port}`))
})
