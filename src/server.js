require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const seedInitialData = require('./utils/seeder');
const { initializeSocket } = require('./socket');

// Initialize Express app
const app = express();
const httpServer = http.createServer(app);

// Initialize WebSocket with HTTP server
initializeSocket(httpServer);

// Connect to MongoDB
connectDB().then(() => {
  seedInitialData();
});

// Allowed CORS origins
const allowedOrigins = [
  'https://lite.easytaka.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach((o) => {
    if (o.trim()) allowedOrigins.push(o.trim());
  });
}

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive fallback
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan('dev'));

// Route Handlers
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/daily', require('./routes/dailyRoutes'));
app.use('/api/daily-tasks', require('./routes/dailyTaskManagerRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'EsyTaka Lite - Facebook Media & Task Manager Backend',
    websocket: 'enabled',
    productionDomain: 'liteapi.easytaka.com',
    clientDomain: 'lite.easytaka.com',
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 EsyTaka Lite Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket Gateway: Active on ws://localhost:${PORT}`);
  console.log(`🌐 Production Client: https://lite.easytaka.com`);
  console.log(`🌐 Production API: https://liteapi.easytaka.com`);
  console.log(`📡 MongoDB URI: ${process.env.MONGODB_URI ? 'Configured' : 'Missing'}`);
  console.log(`☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME || 'bmiez0ep'}`);
  console.log(`===================================================`);
});
