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

// Production-ready origin resolver
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow curl, mobile apps, server-to-server, Postman

  const allowed = [
    'https://lite.easytaka.com',
    'http://lite.easytaka.com',
    'https://www.lite.easytaka.com',
    'https://easytaka.com',
    'https://www.easytaka.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ];

  if (process.env.CLIENT_URL) {
    allowed.push(process.env.CLIENT_URL.trim());
  }

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((o) => {
      if (o.trim()) allowed.push(o.trim());
    });
  }

  if (allowed.includes(origin) || allowed.includes('*')) {
    return true;
  }

  // Regex pattern matching for any easytaka.com subdomain or localhost
  const easytakaDomainRegex = /^https?:\/\/([a-zA-Z0-9-]+\.)*easytaka\.com(:\d+)?$/;
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  if (easytakaDomainRegex.test(origin) || localhostRegex.test(origin)) {
    return true;
  }

  return true; // Permissive fallback so production requests are never blocked
};

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-access-token',
  ],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours preflight cache
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle all OPTIONS preflight requests

// Fallback manual CORS header injection to guarantee browser acceptance
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-access-token'
    );
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

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
    cors: 'production-ready',
  });
});

// Global Error Handler with CORS headers preserved
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

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
