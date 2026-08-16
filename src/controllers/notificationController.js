const Notification = require('../models/Notification');

// Get current user's notifications + broadcast notifications
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const query = {
      $or: [
        { userId },
        { targetRole: userRole, userId: null },
        { targetRole: 'all' },
      ],
    };

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ ...query, isRead: false }),
    ]);

    return res.json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark single notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all user's notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    await Notification.updateMany(
      {
        $or: [
          { userId },
          { targetRole: userRole, userId: null },
          { targetRole: 'all' },
        ],
        isRead: false,
      },
      { isRead: true }
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
