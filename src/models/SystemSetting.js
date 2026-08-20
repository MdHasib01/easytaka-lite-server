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
    if (shouldSave) {
      await settings.save();
    }
  }
  return settings;
};

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
