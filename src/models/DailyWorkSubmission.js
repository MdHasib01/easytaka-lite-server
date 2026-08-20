const mongoose = require('mongoose');

const dailyWorkSubmissionSchema = new mongoose.Schema(
  {
    smmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    overallProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalAccounts: {
      type: Number,
      default: 0,
    },
    completedAccountsCount: {
      type: Number,
      default: 0,
    },
    accountSummaries: [
      {
        facebookAccountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'FacebookAccount',
        },
        accountName: { type: String, default: '' },
        profileUrl: { type: String, default: '' },
        avatarUrl: { type: String, default: '' },
        accountMode: { type: String, default: 'general' },
        assignedProduct: { type: String, default: 'none' },
        completionPercentage: { type: Number, default: 0 },
        isCompleted: { type: Boolean, default: false },
        commentsCount: { type: Number, default: 0 },
        communityRepliesCount: { type: Number, default: 0 },
        storyPostDone: { type: Boolean, default: false },
        feedScrollDone: { type: Boolean, default: false },
        groupShareCount: { type: Number, default: 0 },
        dynamicChecklist: [
          {
            title: { type: String },
            taskType: { type: String },
            mode: { type: String },
            isDone: { type: Boolean, default: false },
          },
        ],
        notes: { type: String, default: '' },
      },
    ],
    smmNotes: {
      type: String,
      default: '',
      trim: true,
    },
    proofUrl: {
      type: String,
      default: '',
      trim: true,
    },
    screenshotUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewScore: {
      type: Number, // 1 to 5
      min: 1,
      max: 5,
      default: null,
    },
    pointsAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    adminFeedback: {
      type: String,
      default: '',
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index to ensure 1 submission per SMM per date
dailyWorkSubmissionSchema.index({ smmId: 1, date: 1 }, { unique: true });
dailyWorkSubmissionSchema.index({ status: 1, date: -1 });

module.exports = mongoose.model('DailyWorkSubmission', dailyWorkSubmissionSchema);
