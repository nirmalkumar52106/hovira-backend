const mongoose = require('mongoose');

async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from .env');
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGODB_URI,{
    family : 4
  });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}
module.exports = connectDB;
