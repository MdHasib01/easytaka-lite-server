const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Notification = require('./models/Notification');

let io = null;

const isOriginAllowed = (origin) => {
  if (!origin) return true;

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

  const easytakaDomainRegex = /^https?:\/\/([a-zA-Z0-9-]+\.)*easytaka\.com(:\d+)?$/;
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  if (easytakaDomainRegex.test(origin) || localhostRegex.test(origin)) {
    return true;
  }

  return true; // Permissive fallback
};

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'x-access-token',
      ],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Socket Auth Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization && socket.handshake.headers.authorization.split(' ')[1]);

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'esy_taka_super_secret_jwt_key_2026_x99!'
      );

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.warn('[Socket Auth Error]', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const userId = user._id.toString();

    console.log(`🔌 [WebSocket] User connected: ${user.name} (${user.email}) [Role: ${user.role}] [Socket: ${socket.id}]`);

    // Join user's personal private room
    socket.join(`user:${userId}`);

    // Join role room (e.g. role:admin or role:smm)
    socket.join(`role:${user.role}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 [WebSocket] User disconnected: ${user.name} (${reason})`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

/**
 * Send real-time notification to a specific user and persist in database
 */
const sendNotificationToUser = async (userId, notificationData) => {
  try {
    const doc = await Notification.create({
      userId,
      targetRole: notificationData.targetRole || 'smm',
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      link: notificationData.link || '',
      points: notificationData.points || 0,
      metadata: notificationData.metadata || {},
    });

    if (io) {
      io.to(`user:${userId.toString()}`).emit('notification:new', {
        notification: doc,
      });
    }
    return doc;
  } catch (err) {
    console.error('Error sending user notification:', err);
    return null;
  }
};

/**
 * Send real-time notification to an entire role group (e.g. all Admins or all SMMs)
 */
const sendNotificationToRole = async (role, notificationData) => {
  try {
    const doc = await Notification.create({
      targetRole: role,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      link: notificationData.link || '',
      points: notificationData.points || 0,
      metadata: notificationData.metadata || {},
    });

    if (io) {
      io.to(`role:${role}`).emit('notification:new', {
        notification: doc,
      });
    }
    return doc;
  } catch (err) {
    console.error('Error sending role notification:', err);
    return null;
  }
};

/**
 * Send real-time broadcast notification to all connected clients
 */
const sendNotificationToAll = async (notificationData) => {
  try {
    const doc = await Notification.create({
      targetRole: 'all',
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      link: notificationData.link || '',
      points: notificationData.points || 0,
      metadata: notificationData.metadata || {},
    });

    if (io) {
      io.emit('notification:new', {
        notification: doc,
      });
    }
    return doc;
  } catch (err) {
    console.error('Error broadcasting notification:', err);
    return null;
  }
};

module.exports = {
  initializeSocket,
  getIO,
  sendNotificationToUser,
  sendNotificationToRole,
  sendNotificationToAll,
};
