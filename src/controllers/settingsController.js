const SystemSetting = require('../models/SystemSetting');

// Get global point and system settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.getSettings();
    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update global point settings (Admin only)
exports.updateSettings = async (req, res) => {
  try {
    const {
      facebookAccountReward,
      facebookMilestoneReward,
      facebookMilestoneStep,
      defaultDailyCompletionReward,
      minWithdrawalPoints,
      maxWithdrawalPoints,
      withdrawalCycleDays,
      pointToBdtRate,
      withdrawalEnabled,
    } = req.body;

    let settings = await SystemSetting.getSettings();

    if (facebookAccountReward !== undefined) {
      settings.facebookAccountReward = Math.max(0, Number(facebookAccountReward));
    }
    if (facebookMilestoneReward !== undefined) {
      settings.facebookMilestoneReward = Math.max(0, Number(facebookMilestoneReward));
    }
    if (facebookMilestoneStep !== undefined) {
      settings.facebookMilestoneStep = Math.max(1, Number(facebookMilestoneStep));
    }
    if (defaultDailyCompletionReward !== undefined) {
      settings.defaultDailyCompletionReward = Math.max(0, Number(defaultDailyCompletionReward));
    }
    if (minWithdrawalPoints !== undefined) {
      settings.minWithdrawalPoints = Math.max(1, Number(minWithdrawalPoints));
    }
    if (maxWithdrawalPoints !== undefined) {
      settings.maxWithdrawalPoints = Math.max(1, Number(maxWithdrawalPoints));
    }
    if (withdrawalCycleDays !== undefined) {
      settings.withdrawalCycleDays = Math.max(1, Number(withdrawalCycleDays));
    }
    if (pointToBdtRate !== undefined) {
      settings.pointToBdtRate = Math.max(0.01, Number(pointToBdtRate));
    }
    if (withdrawalEnabled !== undefined) {
      settings.withdrawalEnabled = Boolean(withdrawalEnabled);
    }

    await settings.save();

    return res.json({
      success: true,
      message: 'System point settings updated successfully.',
      settings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
