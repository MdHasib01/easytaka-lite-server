const mongoose = require('mongoose');

const taskSubmissionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    smmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    facebookAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacebookAccount',
      default: null,
    },
    profileUrl: {
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
    screenshotPublicId: {
      type: String,
      default: '',
    },
    smmNotes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    adminNote: {
      type: String,
      default: '',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    pointsAwarded: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TaskSubmission', taskSubmissionSchema);
