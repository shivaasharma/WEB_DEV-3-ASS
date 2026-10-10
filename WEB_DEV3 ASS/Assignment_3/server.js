const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./db/db');
const productRoutes = require('./routes/productRoutes');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect Database
connectDB();

const app = express();

// Body Parser Middleware
app.use(express.json());

// Mount API Routes
app.use('/api/products', productRoutes);

// Centralized Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
