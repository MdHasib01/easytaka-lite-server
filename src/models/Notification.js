const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    targetRole: {
      type: String,
      enum: ['admin', 'smm', 'all'],
      default: 'smm',
    },
    type: {
      type: String,
      enum: [
        'task_approved',
        'task_rejected',
        'account_approved',
        'account_rejected',
        'milestone_unlocked',
        'daily_reward',
        'new_task',
        'new_submission',
        'new_account',
        'new_smm_verification',
        'withdrawal_requested',
        'withdrawal_approved',
        'withdrawal_paid',
        'withdrawal_rejected',
        'system_alert',
        'facebook_otp_received',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: '',
    },
    points: {
      type: Number,
      default: 0,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ targetRole: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
