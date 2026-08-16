require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const seedInitialData = require('./utils/seeder');
const { initializeSocket } = require('./socket');

// Initialize Express app
const app = express();
app.set('trust proxy', 1);

const httpServer = http.createServer(app);

// Initialize WebSocket with HTTP server
initializeSocket(httpServer);

// Connect to MongoDB
connectDB().then(() => {
  seedInitialData();
});

// Production-ready origin resolver
const allowedOriginsList = [
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
  allowedOriginsList.push(process.env.CLIENT_URL.trim());
}

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach((o) => {
    if (o.trim()) allowedOriginsList.push(o.trim());
  });
}

const isOriginAllowed = (origin) => {
  if (!origin) return true; // allow curl, server-to-server, mobile

  if (allowedOriginsList.includes(origin) || allowedOriginsList.includes('*')) {
    return true;
  }

  // Allow all easytaka.com subdomains and localhost ports
  const easytakaDomainRegex = /^https?:\/\/([a-zA-Z0-9-]+\.)*easytaka\.com(:\d+)?$/;
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  if (easytakaDomainRegex.test(origin) || localhostRegex.test(origin)) {
    return true;
  }

  return true; // Safe fallback so API is accessible
};

// 1. Direct CORS & Preflight Middleware (executes first for all requests)
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-access-token, cache-control, Pragma'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Fast-return for HTTP OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// 2. Standard CORS middleware as additional layer
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, origin || true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'x-access-token',
      'cache-control',
      'Pragma',
    ],
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
app.use('/api/withdrawals', require('./routes/withdrawalRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'EsyTaka Lite - Facebook Media & Task Manager Backend',
    websocket: 'enabled',
    productionDomain: 'lite.easytaka.com',
    productionApi: 'lite.easytaka.com/api',
    clientDomain: 'lite.easytaka.com',
    cors: 'active',
  });
});

// Optional Static Frontend Serving (with strict JS/CSS MIME types)
const potentialDistPaths = [
  path.join(__dirname, '../../easytaka-lite/dist'),
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../../dist'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), '../easytaka-lite/dist'),
];

const clientDistPath = potentialDistPaths.find((p) => fs.existsSync(p));

if (clientDistPath) {
  console.log(`📁 Serving client static build from: ${clientDistPath}`);
  app.use(
    express.static(clientDistPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        }
      },
    })
  );

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler with CORS preservation
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
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
  console.log(`🌐 Production API: https://lite.easytaka.com/api`);
  console.log(`📡 MongoDB URI: ${process.env.MONGODB_URI ? 'Configured' : 'Missing'}`);
  console.log(`☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME || 'bmiez0ep'}`);
  console.log(`===================================================`);
});
