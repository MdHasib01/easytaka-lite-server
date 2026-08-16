const mongoose = require('mongoose');

const facebookAccountSchema = new mongoose.Schema(
  {
    smmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    profileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    profileUid: {
      type: String,
      trim: true,
      default: '',
    },
    emailOrPhone: {
      type: String,
      trim: true,
      default: '',
    },
    password: {
      type: String,
      default: '',
    },
    passwordHint: {
      type: String,
      default: '',
    },
    twoFactorSecret: {
      type: String,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'warmup', 'restricted', 'checkpoint', 'banned'],
      default: 'warmup',
    },
    accountCategory: {
      type: String,
      default: 'Personal / Engagement',
    },
    targetRegion: {
      type: String,
      default: 'Global',
    },
    friendsCount: {
      type: Number,
      default: 0,
    },
    groupsCount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    // Fixed daily routine tasks targets for this account
    routineTargets: {
      feedComments: { type: Number, default: 5 },
      communityReplies: { type: Number, default: 3 },
      storyPost: { type: Boolean, default: true },
      groupShare: { type: Number, default: 2 },
      feedScrollMinutes: { type: Number, default: 10 },
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      default: '',
    },
    pointsAwarded: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FacebookAccount', facebookAccountSchema);
