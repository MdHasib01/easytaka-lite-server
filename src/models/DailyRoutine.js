const mongoose = require('mongoose');

const dailyRoutineSchema = new mongoose.Schema(
  {
    smmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    facebookAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacebookAccount',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    items: {
      profilePicUploaded: { type: Boolean, default: false },
      coverPhotoUploaded: { type: Boolean, default: false },
      maritalStatusUpdated: { type: Boolean, default: false },
      schoolCollegeUpdated: { type: Boolean, default: false },
      identityPostDone: { type: Boolean, default: false },
      feedScrollDone: { type: Boolean, default: false },
      commentsCount: { type: Number, default: 0 },
      communityRepliesCount: { type: Number, default: 0 },
      storyPostDone: { type: Boolean, default: false },
      groupShareCount: { type: Number, default: 0 },
      mandatoryChecklist: [
        {
          taskId: { type: String, required: true },
          isDone: { type: Boolean, default: false },
          completedAt: { type: Date },
        },
      ],
      customChecklist: [
        {
          taskName: { type: String },
          isDone: { type: Boolean, default: false },
        },
      ],
      dynamicChecklist: [
        {
          templateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DailyTaskTemplate',
          },
          assignmentId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          title: { type: String },
          taskType: { type: String },
          mode: { type: String },
          description: { type: String },
          targetUrl: { type: String },
          instructions: { type: String },
          sampleCaption: { type: String },
          isDone: { type: Boolean, default: false },
          completedAt: { type: Date },
        },
      ],
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Index to ensure 1 routine record per SMM + FB Account per date
dailyRoutineSchema.index({ smmId: 1, facebookAccountId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyRoutine', dailyRoutineSchema);
