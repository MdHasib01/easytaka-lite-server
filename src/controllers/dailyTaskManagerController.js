const DailyTaskTemplate = require('../models/DailyTaskTemplate');
const FacebookAccount = require('../models/FacebookAccount');
const taskDistributionService = require('../services/taskDistributionService');

// List all Admin Daily Tasks
exports.listDailyTasks = async (req, res) => {
  try {
    const { mode, status, taskType } = req.query;
    const filter = {};
    if (mode && mode !== 'all') filter.mode = mode;
    if (status && status !== 'all') filter.status = status;
    if (taskType && taskType !== 'all') filter.taskType = taskType;

    const tasks = await DailyTaskTemplate.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedAssignments.accountId', 'accountName profileUrl avatarUrl status')
      .populate('assignedAssignments.smmId', 'name email')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error('List daily tasks error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new Daily Task (Global Rotated or Targeted Quota)
exports.createDailyTask = async (req, res) => {
  try {
    const {
      title,
      taskType,
      description,
      targetUrl,
      instructions,
      sampleCaption,
      mode,
      rotationSchedule,
      rotationBatch,
      targetExecutionsCount,
      validFrom,
      validUntil,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }

    const template = new DailyTaskTemplate({
      title: title.trim(),
      taskType: taskType || 'personal_profile_post',
      description: description || '',
      targetUrl: targetUrl || '',
      instructions: instructions || '',
      sampleCaption: sampleCaption || '',
      mode: mode || 'global_rotation',
      rotationSchedule: rotationSchedule || 'alternate_days',
      rotationBatch: Number(rotationBatch) || 1,
      targetExecutionsCount: Number(targetExecutionsCount) || 10,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      createdBy: req.user._id,
      status: 'active',
    });

    await template.save();

    // If targeted quota campaign, run load balancer assignment
    if (template.mode === 'targeted_quota') {
      await taskDistributionService.distributeQuotaTask(
        template._id,
        template.targetExecutionsCount
      );
    }

    const populated = await DailyTaskTemplate.findById(template._id)
      .populate('assignedAssignments.accountId', 'accountName profileUrl avatarUrl')
      .populate('assignedAssignments.smmId', 'name email');

    // Notify SMM agents
    const { sendNotificationToRole } = require('../socket');
    sendNotificationToRole('smm', {
      type: 'new_task',
      title: template.mode === 'targeted_quota' ? '⚡ New Targeted Campaign Task' : '⚡ New Daily Engagement Task',
      message: `"${template.title}" has been assigned to active accounts.`,
      link: '/daily',
    });

    return res.status(201).json({
      success: true,
      message: `Daily task "${template.title}" created successfully!`,
      task: populated,
    });
  } catch (error) {
    console.error('Create daily task error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update Daily Task Template
exports.updateDailyTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await DailyTaskTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Daily task not found.' });
    }

    const previousQuota = template.targetExecutionsCount;

    // Apply allowed updates
    const fields = [
      'title',
      'taskType',
      'description',
      'targetUrl',
      'instructions',
      'sampleCaption',
      'status',
      'rotationSchedule',
      'rotationBatch',
      'targetExecutionsCount',
      'validFrom',
      'validUntil',
    ];

    fields.forEach((f) => {
      if (updates[f] !== undefined) {
        template[f] = updates[f];
      }
    });

    await template.save();

    // If quota mode and quota was changed, redistribute
    if (
      template.mode === 'targeted_quota' &&
      updates.targetExecutionsCount &&
      updates.targetExecutionsCount !== previousQuota
    ) {
      await taskDistributionService.distributeQuotaTask(
        template._id,
        template.targetExecutionsCount
      );
    }

    const populated = await DailyTaskTemplate.findById(template._id)
      .populate('assignedAssignments.accountId', 'accountName profileUrl avatarUrl')
      .populate('assignedAssignments.smmId', 'name email');

    return res.json({
      success: true,
      message: 'Daily task updated successfully!',
      task: populated,
    });
  } catch (error) {
    console.error('Update daily task error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Daily Task
exports.deleteDailyTask = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await DailyTaskTemplate.findByIdAndDelete(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Daily task not found.' });
    }

    return res.json({
      success: true,
      message: 'Daily task deleted successfully.',
    });
  } catch (error) {
    console.error('Delete daily task error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Preview Load Balancer Distribution
exports.previewLoadBalancer = async (req, res) => {
  try {
    const quota = req.query.quota || 10;
    const preview = await taskDistributionService.previewQuotaDistribution(quota);
    return res.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error('Preview load balancer error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Overview statistics for Admin Daily Task Manager
exports.getDailyTaskStats = async (req, res) => {
  try {
    const [globalCount, quotaCount, totalAccounts, activeSMMs] = await Promise.all([
      DailyTaskTemplate.countDocuments({ mode: 'global_rotation', status: 'active' }),
      DailyTaskTemplate.countDocuments({ mode: 'targeted_quota', status: 'active' }),
      FacebookAccount.countDocuments({ isActive: true, approvalStatus: { $in: ['approved', null] } }),
      FacebookAccount.distinct('smmId', { isActive: true }),
    ]);

    return res.json({
      success: true,
      stats: {
        activeGlobalTasks: globalCount,
        activeQuotaCampaigns: quotaCount,
        totalEligibleAccounts: totalAccounts,
        activeSmmCount: activeSMMs.length,
      },
    });
  } catch (error) {
    console.error('Get daily task stats error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
