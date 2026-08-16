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
