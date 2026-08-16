const mongoose = require('mongoose');

const dailyTaskTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    taskType: {
      type: String,
      enum: [
        'personal_profile_post',
        'react_group_post',
        'comment_group_post',
        'group_join',
        'story_post',
        'feed_scroll_warmup',
        'custom_engagement',
      ],
      required: true,
      default: 'personal_profile_post',
    },
    description: {
      type: String,
      default: '',
    },
    targetUrl: {
      type: String,
      trim: true,
      default: '',
    },
    instructions: {
      type: String,
      default: '',
    },
    sampleCaption: {
      type: String,
      default: '',
    },
    mode: {
      type: String,
      enum: ['global_rotation', 'targeted_quota'],
      default: 'global_rotation',
    },
    // For global_rotation mode
    rotationSchedule: {
      type: String,
      enum: ['alternate_days', 'every_day', 'odd_days', 'even_days', 'weekday_only'],
      default: 'alternate_days',
    },
    rotationBatch: {
      type: Number, // 1 for Batch A, 2 for Batch B
      default: 1,
    },
    // For targeted_quota mode
    targetExecutionsCount: {
      type: Number,
      default: 10,
      min: 1,
    },
    completedExecutionsCount: {
      type: Number,
      default: 0,
    },
    assignedAssignments: [
      {
        accountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'FacebookAccount',
          required: true,
        },
        smmId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        date: {
          type: String, // YYYY-MM-DD
        },
        isCompleted: {
          type: Boolean,
          default: false,
        },
        completedAt: {
          type: Date,
        },
        notes: {
          type: String,
          default: '',
        },
      },
    ],
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'archived'],
      default: 'active',
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

dailyTaskTemplateSchema.index({ status: 1, mode: 1 });
dailyTaskTemplateSchema.index({ 'assignedAssignments.accountId': 1, 'assignedAssignments.date': 1 });

module.exports = mongoose.model('DailyTaskTemplate', dailyTaskTemplateSchema);
