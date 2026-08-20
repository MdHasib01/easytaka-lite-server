const SystemSetting = require('../models/SystemSetting');
const { encrypt } = require('../utils/encryption');

// Masks secret fields before sending settings to the client.
const maskSettings = (settingsDoc) => {
  const settings = settingsDoc.toObject ? settingsDoc.toObject() : { ...settingsDoc };

  if (settings.recoveryEmailConfig) {
    const { appPassword, ...rest } = settings.recoveryEmailConfig;
    settings.recoveryEmailConfig = { ...rest, appPasswordSet: Boolean(appPassword) };
  }
  if (settings.aiConfig) {
    const { apiKey, ...rest } = settings.aiConfig;
    settings.aiConfig = { ...rest, apiKeySet: Boolean(apiKey) };
  }

  return settings;
};

// Get global point and system settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.getSettings();
    return res.json({
      success: true,
      settings: maskSettings(settings),
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
      dailyTaskScoreRules,
      minWithdrawalPoints,
      maxWithdrawalPoints,
      withdrawalCycleDays,
      pointToBdtRate,
      withdrawalEnabled,
      recoveryEmailConfig,
      aiConfig,
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
    if (dailyTaskScoreRules !== undefined && typeof dailyTaskScoreRules === 'object') {
      settings.dailyTaskScoreRules = {
        score5Points: dailyTaskScoreRules.score5Points !== undefined ? Math.max(0, Number(dailyTaskScoreRules.score5Points)) : (settings.dailyTaskScoreRules?.score5Points ?? 100),
        score4Points: dailyTaskScoreRules.score4Points !== undefined ? Math.max(0, Number(dailyTaskScoreRules.score4Points)) : (settings.dailyTaskScoreRules?.score4Points ?? 80),
        score3Points: dailyTaskScoreRules.score3Points !== undefined ? Math.max(0, Number(dailyTaskScoreRules.score3Points)) : (settings.dailyTaskScoreRules?.score3Points ?? 60),
        score2Points: dailyTaskScoreRules.score2Points !== undefined ? Math.max(0, Number(dailyTaskScoreRules.score2Points)) : (settings.dailyTaskScoreRules?.score2Points ?? 40),
        score1Points: dailyTaskScoreRules.score1Points !== undefined ? Math.max(0, Number(dailyTaskScoreRules.score1Points)) : (settings.dailyTaskScoreRules?.score1Points ?? 20),
      };
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

    if (recoveryEmailConfig !== undefined) {
      const { address, appPassword, imapHost, imapPort, enabled, pollIntervalSeconds, triggerSender } =
        recoveryEmailConfig;
      if (address !== undefined) settings.recoveryEmailConfig.address = String(address).trim();
      if (appPassword) settings.recoveryEmailConfig.appPassword = encrypt(appPassword); // only overwrite on a real new value
      if (imapHost !== undefined) settings.recoveryEmailConfig.imapHost = String(imapHost).trim() || 'imap.gmail.com';
      if (imapPort !== undefined) settings.recoveryEmailConfig.imapPort = Number(imapPort) || 993;
      if (enabled !== undefined) settings.recoveryEmailConfig.enabled = Boolean(enabled);
      if (pollIntervalSeconds !== undefined) {
        settings.recoveryEmailConfig.pollIntervalSeconds = Math.max(30, Number(pollIntervalSeconds));
      }
      if (triggerSender !== undefined) settings.recoveryEmailConfig.triggerSender = String(triggerSender).trim();
    }

    if (aiConfig !== undefined) {
      const { provider, model, apiKey, enabled } = aiConfig;
      if (provider !== undefined && ['openai', 'gemini'].includes(provider)) settings.aiConfig.provider = provider;
      if (model !== undefined) settings.aiConfig.model = String(model).trim();
      if (apiKey) settings.aiConfig.apiKey = encrypt(apiKey); // only overwrite on a real new value
      if (enabled !== undefined) settings.aiConfig.enabled = Boolean(enabled);
    }

    await settings.save();

    return res.json({
      success: true,
      message: 'System point settings updated successfully.',
      settings: maskSettings(settings),
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
