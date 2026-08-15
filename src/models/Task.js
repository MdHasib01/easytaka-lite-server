const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    taskType: {
      type: String,
      enum: ['create_account', 'comment_post', 'community_reply', 'group_join', 'story_post', 'custom'],
      default: 'custom',
    },
    category: {
      type: String,
      default: 'Facebook Engagement',
    },
    rewardPoints: {
      type: Number,
      required: true,
      default: 50,
      min: 1,
    },
    targetUrl: {
      type: String,
      default: '',
    },
    instructions: {
      type: String,
      default: '',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null means open to all SMMs
    },
    isBroadcast: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    screenshotRequired: {
      type: Boolean,
      default: true,
    },
    profileLinkRequired: {
      type: Boolean,
      default: true,
    },
    deadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
