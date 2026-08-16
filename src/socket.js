const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Notification = require('./models/Notification');

let io = null;

const getAllowedOrigins = () => {
  const defaults = [
    'https://lite.easytaka.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];

  if (process.env.ALLOWED_ORIGINS) {
    const extra = process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    return Array.from(new Set([...defaults, ...extra]));
  }
  return defaults;
};

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        const allowed = getAllowedOrigins();
        if (allowed.includes(origin) || allowed.includes('*')) {
          return callback(null, true);
        }
        return callback(null, true); // Fallback allow in dev
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
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
