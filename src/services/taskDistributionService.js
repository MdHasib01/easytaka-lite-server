const DailyTaskTemplate = require('../models/DailyTaskTemplate');
const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');

class TaskDistributionService {
  /**
   * Preview load-balanced quota distribution across active SMMs and approved accounts
   */
  async previewQuotaDistribution(targetCount) {
    const activeAccounts = await FacebookAccount.find({
      isActive: true,
      approvalStatus: { $in: ['approved', null] },
    }).populate('smmId', 'name email');

    if (activeAccounts.length === 0) {
      return {
        totalAccountsAvailable: 0,
        smmCount: 0,
        smmBreakdown: [],
        canFulfillQuota: false,
      };
    }

    // Group accounts by SMM
    const smmMap = new Map();
    for (const acc of activeAccounts) {
      const smm = acc.smmId;
      if (!smm) continue;
      const smmId = (smm._id || smm).toString();
      if (!smmMap.has(smmId)) {
        smmMap.set(smmId, {
          smmId,
          smmName: smm.name || 'SMM Agent',
          smmEmail: smm.email || '',
          accounts: [],
        });
      }
      smmMap.get(smmId).accounts.push(acc);
    }

    const smmList = Array.from(smmMap.values());
    const quota = Math.min(Number(targetCount) || 1, activeAccounts.length);
    const assignedPerSmm = new Map(smmList.map((s) => [s.smmId, []]));

    // Round-robin load balancer allocation
    let currentAssigned = 0;
    let round = 0;
    while (currentAssigned < quota) {
      let allocatedInRound = 0;
      for (const smm of smmList) {
        if (currentAssigned >= quota) break;
        const smmAccounts = smm.accounts;
        const alreadyAssigned = assignedPerSmm.get(smm.smmId) || [];
        if (alreadyAssigned.length < smmAccounts.length) {
          const nextAccount = smmAccounts[alreadyAssigned.length];
          alreadyAssigned.push(nextAccount);
          assignedPerSmm.set(smm.smmId, alreadyAssigned);
          currentAssigned++;
          allocatedInRound++;
        }
      }
      round++;
      if (allocatedInRound === 0) break; // All accounts assigned
    }

    const smmBreakdown = smmList.map((s) => ({
      smmId: s.smmId,
      smmName: s.smmName,
      smmEmail: s.smmEmail,
      totalAccountsOwned: s.accounts.length,
      assignedCount: (assignedPerSmm.get(s.smmId) || []).length,
      assignedAccounts: (assignedPerSmm.get(s.smmId) || []).map((a) => ({
        id: a._id,
        name: a.accountName,
      })),
    }));

    return {
      totalAccountsAvailable: activeAccounts.length,
      smmCount: smmList.length,
      targetQuota: Number(targetCount) || 1,
      actualAllocated: currentAssigned,
      smmBreakdown,
      canFulfillQuota: activeAccounts.length >= Number(targetCount),
    };
  }

  /**
   * Distribute a targeted quota campaign task across active Facebook accounts using fair load balancing
   */
  async distributeQuotaTask(templateId, targetCount, targetDate) {
    const template = await DailyTaskTemplate.findById(templateId);
    if (!template) {
      throw new Error('Daily task template not found');
    }

    const activeAccounts = await FacebookAccount.find({
      isActive: true,
      approvalStatus: { $in: ['approved', null] },
    });

    if (activeAccounts.length === 0) {
      return template;
    }

    // Group accounts by SMM
    const smmMap = new Map();
    for (const acc of activeAccounts) {
      const smmId = (acc.smmId._id || acc.smmId).toString();
      if (!smmMap.has(smmId)) {
        smmMap.set(smmId, []);
      }
      smmMap.get(smmId).push(acc);
    }

    // Shuffle accounts within each SMM for randomness
    for (const [smmId, accList] of smmMap.entries()) {
      smmMap.set(smmId, accList.sort(() => Math.random() - 0.5));
    }

    const smmKeys = Array.from(smmMap.keys()).sort(() => Math.random() - 0.5);
    const quota = Math.min(Number(targetCount) || template.targetExecutionsCount || 10, activeAccounts.length);
    const assignments = [];
    const smmAssignedCount = new Map(smmKeys.map((id) => [id, 0]));

    let currentTotal = 0;
    while (currentTotal < quota) {
      let allocatedThisPass = 0;
      for (const smmId of smmKeys) {
        if (currentTotal >= quota) break;
        const smmAccounts = smmMap.get(smmId) || [];
        const count = smmAssignedCount.get(smmId) || 0;
        if (count < smmAccounts.length) {
          const acc = smmAccounts[count];
          assignments.push({
            accountId: acc._id,
            smmId: acc.smmId,
            date: targetDate || new Date().toISOString().split('T')[0],
            isCompleted: false,
          });
          smmAssignedCount.set(smmId, count + 1);
          currentTotal++;
          allocatedThisPass++;
        }
      }
      if (allocatedThisPass === 0) break;
    }

    template.targetExecutionsCount = quota;
    template.assignedAssignments = assignments;
    await template.save();

    return template;
  }

  /**
   * Resolve dynamic daily tasks (Rotated Global Tasks + Assigned Quota Tasks) for a specific account and date
   */
  async getDailyTasksForAccount(accountId, smmId, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const account = await FacebookAccount.findById(accountId);
    if (!account) return [];

    const dynamicTasks = [];

    // 1. GLOBAL ROTATION TASKS
    const globalTemplates = await DailyTaskTemplate.find({
      mode: 'global_rotation',
      status: 'active',
    }).sort({ createdAt: 1 });

    if (globalTemplates.length > 0) {
      const dateObj = new Date(targetDate);
      const dayOfMonth = dateObj.getDate();
      const dayOfYear = Math.floor((dateObj - new Date(dateObj.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
      
      // Compute deterministic account hash
      const accountHash = account._id
        .toString()
        .split('')
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);

      // Account batch: 1 or 2
      const accountBatch = (accountHash % 2) + 1;
      const dayParity = ((dayOfYear % 2) + 2) % 2; // 0 (even day) or 1 (odd day)

      for (let i = 0; i < globalTemplates.length; i++) {
        const template = globalTemplates[i];
        const schedule = template.rotationSchedule || 'alternate_days';
        let shouldInclude = false;

        if (schedule === 'every_day') {
          shouldInclude = true;
        } else if (schedule === 'odd_days') {
          shouldInclude = dayOfMonth % 2 !== 0;
        } else if (schedule === 'even_days') {
          shouldInclude = dayOfMonth % 2 === 0;
        } else if (schedule === 'weekday_only') {
          const dayOfWeek = dateObj.getDay();
          shouldInclude = dayOfWeek >= 1 && dayOfWeek <= 5;
        } else {
          // 'alternate_days'
          // Assign template to Batch 1 or Batch 2 if not explicitly set
          const templateBatch = template.rotationBatch || ((i % 2) + 1);

          // Alternating schedule:
          // If (accountBatch + dayParity) % 2 === 0 -> does Batch 1 today
          // If (accountBatch + dayParity) % 2 === 1 -> does Batch 2 today
          const activeBatchToday = ((accountBatch + dayParity) % 2 === 0) ? 1 : 2;
          shouldInclude = templateBatch === activeBatchToday;
        }

        if (shouldInclude) {
          dynamicTasks.push({
            templateId: template._id,
            title: template.title,
            taskType: template.taskType,
            mode: 'global_rotation',
            description: template.description,
            targetUrl: template.targetUrl,
            instructions: template.instructions,
            sampleCaption: template.sampleCaption,
            rotationSchedule: schedule,
          });
        }
      }
    }

    // 2. TARGETED QUOTA CAMPAIGN TASKS
    const quotaTemplates = await DailyTaskTemplate.find({
      mode: 'targeted_quota',
      status: 'active',
      'assignedAssignments.accountId': account._id,
    });

    for (const template of quotaTemplates) {
      const assignment = template.assignedAssignments.find(
        (a) => a.accountId.toString() === account._id.toString() && (!a.date || a.date === targetDate)
      );

      if (assignment) {
        dynamicTasks.push({
          templateId: template._id,
          assignmentId: assignment._id,
          title: template.title,
          taskType: template.taskType,
          mode: 'targeted_quota',
          description: template.description,
          targetUrl: template.targetUrl,
          instructions: template.instructions,
          sampleCaption: template.sampleCaption,
          isCompleted: !!assignment.isCompleted,
        });
      }
    }

    return dynamicTasks;
  }
}

module.exports = new TaskDistributionService();
