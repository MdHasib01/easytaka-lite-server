const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    facebookAccountReward: {
      type: Number,
      default: 40,
      min: 0,
    },
    facebookMilestoneReward: {
      type: Number,
      default: 100,
      min: 0,
    },
    facebookMilestoneStep: {
      type: Number,
      default: 5,
      min: 1,
    },
    defaultDailyCompletionReward: {
      type: Number,
      default: 100,
      min: 0,
    },
    dailyTaskScoreRules: {
      score5Points: { type: Number, default: 100, min: 0 },
      score4Points: { type: Number, default: 80, min: 0 },
      score3Points: { type: Number, default: 60, min: 0 },
      score2Points: { type: Number, default: 40, min: 0 },
      score1Points: { type: Number, default: 20, min: 0 },
    },
    ratingBreakpoints: [
      {
        minRating: { type: Number, required: true },
        points: { type: Number, required: true },
        label: { type: String, default: '' },
      },
    ],
    minWithdrawalPoints: {
      type: Number,
      default: 50,
      min: 1,
    },
    maxWithdrawalPoints: {
      type: Number,
      default: 1000,
      min: 1,
    },
    withdrawalCycleDays: {
      type: Number,
      default: 7,
      min: 1,
    },
    pointToBdtRate: {
      type: Number,
      default: 1,
      min: 0.01,
    },
    withdrawalEnabled: {
      type: Boolean,
      default: true,
    },
    recoveryEmailConfig: {
      address: { type: String, default: '' },
      appPassword: { type: String, default: '' }, // encrypted at rest, see utils/encryption.js
      imapHost: { type: String, default: 'imap.gmail.com' },
      imapPort: { type: Number, default: 993 },
      enabled: { type: Boolean, default: false },
      pollIntervalSeconds: { type: Number, default: 60, min: 30 },
      // Sender to watch for, e.g. "Facebook <notification@facebook.com>" or just the email address.
      // When set, only mail from this sender is passed to the AI; otherwise falls back to a generic
      // facebook/meta sender heuristic.
      triggerSender: { type: String, default: '' },
    },
    mandatoryDailyTasks: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true },
        titleEn: { type: String, default: '' },
        description: { type: String, default: '' },
        taskType: {
          type: String,
          enum: [
            'profile_pic',
            'cover_photo',
            'marital_status',
            'school_college',
            'identity_post',
            'group_join',
            'custom',
          ],
          default: 'custom',
        },
        groupName: { type: String, default: '' },
        targetUrl: { type: String, default: '' },
        isEnabled: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
      },
    ],
    aiConfig: {
      provider: { type: String, enum: ['openai', 'gemini'], default: 'openai' },
      model: { type: String, default: '' },
      apiKey: { type: String, default: '' }, // encrypted at rest, see utils/encryption.js
      enabled: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Fixed id for the singleton document. The `systemsettings` collection also contains
// unrelated legacy documents (from a removed "Quality & Fraud" per-key settings
// feature) that predate this model. A bare findOne() with no filter has no guaranteed
// order and could return one of those instead of the real settings doc — pinning to a
// fixed id makes lookups deterministic regardless of what else is in the collection.
const SINGLETON_ID = new mongoose.Types.ObjectId('6a71abd403171022222d2391');

// Singleton helper to get or create settings
systemSettingSchema.statics.getSettings = async function () {
  let settings = await this.findById(SINGLETON_ID);
  if (!settings) {
    settings = await this.create({
      _id: SINGLETON_ID,
      facebookAccountReward: 40,
      facebookMilestoneReward: 100,
      facebookMilestoneStep: 5,
      defaultDailyCompletionReward: 100,
      dailyTaskScoreRules: {
        score5Points: 100,
        score4Points: 80,
        score3Points: 60,
        score2Points: 40,
        score1Points: 20,
      },
      ratingBreakpoints: [
        { minRating: 5.0, points: 90, label: '5.0 ⭐ (Excellent)' },
        { minRating: 4.5, points: 85, label: '4.5 ⭐ (Superior)' },
        { minRating: 4.0, points: 80, label: '4.0 ⭐ (Very Good)' },
        { minRating: 3.5, points: 70, label: '3.5 ⭐ (Good Plus)' },
        { minRating: 3.0, points: 60, label: '3.0 ⭐ (Good)' },
        { minRating: 2.5, points: 50, label: '2.5 ⭐ (Satisfactory)' },
        { minRating: 2.0, points: 40, label: '2.0 ⭐ (Average)' },
        { minRating: 1.5, points: 30, label: '1.5 ⭐ (Below Average)' },
        { minRating: 1.0, points: 20, label: '1.0 ⭐ (Poor)' },
      ],
      minWithdrawalPoints: 50,
      maxWithdrawalPoints: 1000,
      withdrawalCycleDays: 7,
      pointToBdtRate: 1,
      withdrawalEnabled: true,
    });
  } else {
    let shouldSave = false;
    if (!settings.dailyTaskScoreRules || settings.dailyTaskScoreRules.score5Points === undefined) {
      settings.dailyTaskScoreRules = {
        score5Points: settings.defaultDailyCompletionReward || 100,
        score4Points: Math.round((settings.defaultDailyCompletionReward || 100) * 0.8),
        score3Points: Math.round((settings.defaultDailyCompletionReward || 100) * 0.6),
        score2Points: Math.round((settings.defaultDailyCompletionReward || 100) * 0.4),
        score1Points: Math.round((settings.defaultDailyCompletionReward || 100) * 0.2),
      };
      shouldSave = true;
    }
    if (!settings.ratingBreakpoints || settings.ratingBreakpoints.length === 0) {
      settings.ratingBreakpoints = [
        { minRating: 5.0, points: 90, label: '5.0 ⭐ (Excellent)' },
        { minRating: 4.5, points: 85, label: '4.5 ⭐ (Superior)' },
        { minRating: 4.0, points: 80, label: '4.0 ⭐ (Very Good)' },
        { minRating: 3.5, points: 70, label: '3.5 ⭐ (Good Plus)' },
        { minRating: 3.0, points: 60, label: '3.0 ⭐ (Good)' },
        { minRating: 2.5, points: 50, label: '2.5 ⭐ (Satisfactory)' },
        { minRating: 2.0, points: 40, label: '2.0 ⭐ (Average)' },
        { minRating: 1.5, points: 30, label: '1.5 ⭐ (Below Average)' },
        { minRating: 1.0, points: 20, label: '1.0 ⭐ (Poor)' },
      ];
      shouldSave = true;
    }
    if (!settings.mandatoryDailyTasks || settings.mandatoryDailyTasks.length === 0) {
      settings.mandatoryDailyTasks = [
        {
          id: 'profile_pic',
          title: 'প্রোফাইল পিকচার আপলোড',
          titleEn: 'Upload profile picture',
          description: 'বাস্তবসম্মত ও শালীন প্রোফাইল ছবি যুক্ত করুন',
          taskType: 'profile_pic',
          groupName: '',
          targetUrl: '',
          isEnabled: true,
          order: 1,
        },
        {
          id: 'cover_photo',
          title: 'কভার ফটো আপলোড',
          titleEn: 'Upload Cover photo',
          description: 'প্রাকৃতিক বা রুচিশীল কভার ছবি আপলোড করুন',
          taskType: 'cover_photo',
          groupName: '',
          targetUrl: '',
          isEnabled: true,
          order: 2,
        },
        {
          id: 'marital_status',
          title: 'বৈবাহিক অবস্থা আপডেট (Married)',
          titleEn: 'Update Marital status',
          description: 'Relationship Status অবশ্যই "Married" (বিবাহিত) সিলেক্ট করুন',
          taskType: 'marital_status',
          groupName: '',
          targetUrl: '',
          isEnabled: true,
          order: 3,
        },
        {
          id: 'school_college',
          title: 'স্কুল/কলেজের তথ্য আপডেট',
          titleEn: 'Update School/College information',
          description: 'প্রোফাইলে বাস্তবসম্মত স্কুল বা কলেজের তথ্য যোগ করুন',
          taskType: 'school_college',
          groupName: '',
          targetUrl: '',
          isEnabled: true,
          order: 4,
        },
        {
          id: 'identity_post',
          title: 'প্রোফাইল ও পরিচয়ের সাথে মিল রেখে পোস্ট',
          titleEn: 'Complete a post related to profile & identity',
          description: 'আইডির মা/সংসার বা বাস্তব পরিচয়ের সাথে মিল রেখে পোস্ট সম্পন্ন করুন',
          taskType: 'identity_post',
          groupName: '',
          targetUrl: '',
          isEnabled: true,
          order: 5,
        },
      ];
      shouldSave = true;
    }
    if (shouldSave) {
      await settings.save();
    }
  }
  return settings;
};

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
