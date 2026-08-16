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
      default: 50,
      min: 0,
    },
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
  },
  { timestamps: true }
);

// Singleton helper to get or create settings
systemSettingSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      facebookAccountReward: 40,
      facebookMilestoneReward: 100,
      facebookMilestoneStep: 5,
      defaultDailyCompletionReward: 50,
      minWithdrawalPoints: 50,
      maxWithdrawalPoints: 1000,
      withdrawalCycleDays: 7,
      pointToBdtRate: 1,
      withdrawalEnabled: true,
    });
  }
  return settings;
};

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
