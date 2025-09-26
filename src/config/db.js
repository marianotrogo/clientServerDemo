import mongoose from 'mongoose'

export const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI
    if (!uri) throw new Error('MONGO_URI not set')

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })

    console.log('✅ MongoDB Connected:', mongoose.connection.name)
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message)
    process.exit(1) // Corta el proceso si falla la conexión
  }
}