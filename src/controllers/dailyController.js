const DailyRoutine = require('../models/DailyRoutine');
const DailyWorkSubmission = require('../models/DailyWorkSubmission');
const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const SystemSetting = require('../models/SystemSetting');
const DailyTaskTemplate = require('../models/DailyTaskTemplate');
const taskDistributionService = require('../services/taskDistributionService');
const { sendNotificationToUser, sendNotificationToRole } = require('../socket');

const getTodayString = () => {
  const d = new Date();
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

// Calculate percentage for a daily routine doc including standard targets and dynamic tasks
const computePercentage = (routine, account) => {
  let totalWeight = 0;
  let earnedWeight = 0;

  // 1. Upload profile picture (weight 20)
  totalWeight += 20;
  if (routine.items?.profilePicUploaded) earnedWeight += 20;

  // 2. Upload Cover photo (weight 20)
  totalWeight += 20;
  if (routine.items?.coverPhotoUploaded) earnedWeight += 20;

  // 3. Update Marital status (weight 20)
  totalWeight += 20;
  if (routine.items?.maritalStatusUpdated) earnedWeight += 20;

  // 4. Update School/College information (weight 20)
  totalWeight += 20;
  if (routine.items?.schoolCollegeUpdated) earnedWeight += 20;

  // 5. Complete a post related to profile and identity (weight 20)
  totalWeight += 20;
  if (routine.items?.identityPostDone) earnedWeight += 20;

  // 6. Dynamic Assigned Tasks (weight 20 each if any)
  const dynamicItems = routine.items?.dynamicChecklist || [];
  if (dynamicItems.length > 0) {
    dynamicItems.forEach((task) => {
      totalWeight += 20;
      if (task.isDone) earnedWeight += 20;
    });
  }

  const percentage = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
  return { percentage, isCompleted: percentage >= 100 };
};

// Get Daily Progress & Routines for SMM for a specific date (defaults to today)
exports.getTodayRoutines = async (req, res) => {
  try {
    const targetDate = req.query.date || getTodayString();
    const user = await User.findById(req.user._id);
    const accounts = await FacebookAccount.find({ smmId: req.user._id, isActive: true });
    const settings = await SystemSetting.getSettings();

    const maxDailyReward = settings.defaultDailyCompletionReward || 100;
    const scoreRules = settings.dailyTaskScoreRules || {
      score5Points: 100,
      score4Points: 80,
      score3Points: 60,
      score2Points: 40,
      score1Points: 20,
    };

    const dailyRewardClaimedToday = user?.lastDailyRewardDate === targetDate;
    const existingSubmission = await DailyWorkSubmission.findOne({
      smmId: req.user._id,
      date: targetDate,
    }).populate('reviewedBy', 'name email');

    if (accounts.length === 0) {
      return res.json({
        success: true,
        date: targetDate,
        totalAccounts: 0,
        overallProgress: 0,
        completedAccountsCount: 0,
        dailyTaskCompletionReward: maxDailyReward,
        scoreRules,
        dailyRewardClaimedToday,
        submission: existingSubmission,
        routines: [],
      });
    }

    const routines = [];
    let totalPercentageSum = 0;
    let completedAccountsCount = 0;

    for (const account of accounts) {
      let routine = await DailyRoutine.findOne({
        smmId: req.user._id,
        facebookAccountId: account._id,
        date: targetDate,
      });

      // Get assigned rotated global and targeted quota tasks for this account today
      const dynamicTasksToday = await taskDistributionService.getDailyTasksForAccount(
        account._id,
        req.user._id,
        targetDate
      );

      if (!routine) {
        routine = new DailyRoutine({
          smmId: req.user._id,
          facebookAccountId: account._id,
          date: targetDate,
          items: {
            profilePicUploaded: false,
            coverPhotoUploaded: false,
            maritalStatusUpdated: false,
            schoolCollegeUpdated: false,
            identityPostDone: false,
            feedScrollDone: false,
            commentsCount: 0,
            communityRepliesCount: 0,
            storyPostDone: false,
            groupShareCount: 0,
            customChecklist: [],
            dynamicChecklist: dynamicTasksToday.map((t) => ({
              templateId: t.templateId,
              assignmentId: t.assignmentId,
              title: t.title,
              taskType: t.taskType,
              mode: t.mode,
              description: t.description,
              targetUrl: t.targetUrl,
              instructions: t.instructions,
              sampleCaption: t.sampleCaption,
              isDone: !!t.isCompleted,
            })),
          },
          completionPercentage: 0,
          isCompleted: false,
        });
      } else {
        // Sync dynamic checklist with current active daily tasks for this date
        const existingDynamic = routine.items.dynamicChecklist || [];
        const existingDoneMap = new Map();
        existingDynamic.forEach((item) => {
          if (item.templateId) {
            existingDoneMap.set(item.templateId.toString(), item.isDone);
          }
        });

        routine.items.dynamicChecklist = dynamicTasksToday.map((t) => ({
          templateId: t.templateId,
          assignmentId: t.assignmentId,
          title: t.title,
          taskType: t.taskType,
          mode: t.mode,
          description: t.description,
          targetUrl: t.targetUrl,
          instructions: t.instructions,
          sampleCaption: t.sampleCaption,
          isDone: existingDoneMap.has(t.templateId.toString())
            ? existingDoneMap.get(t.templateId.toString())
            : !!t.isCompleted,
        }));
      }

      const { percentage, isCompleted } = computePercentage(routine, account);
      routine.completionPercentage = percentage;
      routine.isCompleted = isCompleted;
      await routine.save();

      totalPercentageSum += routine.completionPercentage;
      if (routine.isCompleted) completedAccountsCount += 1;

      routines.push({
        routine,
        account: {
          id: account._id,
          accountName: account.accountName,
          profileUrl: account.profileUrl,
          avatarUrl: account.avatarUrl,
          status: account.status,
          approvalStatus: account.approvalStatus || 'approved',
          accountMode: account.accountMode || 'general',
          assignedProduct: account.assignedProduct || 'none',
          workloadTier: account.workloadTier || 'active',
          childAge: account.childAge || '',
          purchaseDate: account.purchaseDate || '',
          purchaseHistory: account.purchaseHistory || '',
          writingStyle: account.writingStyle || 'Bangla (বাঙালি মা টোন)',
          personaBio: account.personaBio || '',
          customGuideline: account.customGuideline || '',
          routineTargets: account.routineTargets,
        },
      });
    }

    const overallProgress = Math.round(totalPercentageSum / accounts.length);

    return res.json({
      success: true,
      date: targetDate,
      totalAccounts: accounts.length,
      overallProgress,
      completedAccountsCount,
      dailyTaskCompletionReward: maxDailyReward,
      scoreRules,
      ratingBreakpoints: settings.ratingBreakpoints || [],
      dailyRewardClaimedToday,
      submission: existingSubmission,
      routines,
    });
  } catch (error) {
    console.error('Get today routines error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update routine items for a Facebook Account
exports.updateRoutineProgress = async (req, res) => {
  try {
    const { accountId, date, updates } = req.body;
    const targetDate = date || getTodayString();

    const account = await FacebookAccount.findOne({ _id: accountId, smmId: req.user._id });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    let routine = await DailyRoutine.findOne({
      smmId: req.user._id,
      facebookAccountId: account._id,
      date: targetDate,
    });

    if (!routine) {
      routine = new DailyRoutine({
        smmId: req.user._id,
        facebookAccountId: account._id,
        date: targetDate,
        items: {},
      });
    }

    // Apply updates to routine.items
    if (updates) {
      if (updates.profilePicUploaded !== undefined) routine.items.profilePicUploaded = updates.profilePicUploaded;
      if (updates.coverPhotoUploaded !== undefined) routine.items.coverPhotoUploaded = updates.coverPhotoUploaded;
      if (updates.maritalStatusUpdated !== undefined) routine.items.maritalStatusUpdated = updates.maritalStatusUpdated;
      if (updates.schoolCollegeUpdated !== undefined) routine.items.schoolCollegeUpdated = updates.schoolCollegeUpdated;
      if (updates.identityPostDone !== undefined) routine.items.identityPostDone = updates.identityPostDone;
      if (updates.feedScrollDone !== undefined) routine.items.feedScrollDone = updates.feedScrollDone;
      if (updates.commentsCount !== undefined) routine.items.commentsCount = Math.max(0, updates.commentsCount);
      if (updates.communityRepliesCount !== undefined)
        routine.items.communityRepliesCount = Math.max(0, updates.communityRepliesCount);
      if (updates.storyPostDone !== undefined) routine.items.storyPostDone = updates.storyPostDone;
      if (updates.groupShareCount !== undefined) routine.items.groupShareCount = Math.max(0, updates.groupShareCount);
      if (updates.customChecklist !== undefined) routine.items.customChecklist = updates.customChecklist;
      if (updates.notes !== undefined) routine.notes = updates.notes;

      // Dynamic tasks checklist updates
      if (updates.dynamicChecklist !== undefined) {
        routine.items.dynamicChecklist = updates.dynamicChecklist;

        // If any targeted quota task was marked done/undone, sync with template
        for (const item of updates.dynamicChecklist) {
          if (item.templateId) {
            const template = await DailyTaskTemplate.findById(item.templateId);
            if (template) {
              const assignment = template.assignedAssignments.find(
                (a) => a.accountId.toString() === account._id.toString()
              );
              if (assignment) {
                assignment.isCompleted = item.isDone;
                assignment.completedAt = item.isDone ? new Date() : null;
              }
              // Recompute completedExecutionsCount
              template.completedExecutionsCount = template.assignedAssignments.filter(
                (a) => a.isCompleted
              ).length;
              if (template.completedExecutionsCount >= template.targetExecutionsCount) {
                template.status = 'completed';
              }
              await template.save();
            }
          }
        }
      }
    }

    const { percentage, isCompleted } = computePercentage(routine, account);
    routine.completionPercentage = percentage;
    routine.isCompleted = isCompleted;
    await routine.save();

    // Check overall progress across all user's active accounts
    const allAccounts = await FacebookAccount.find({ smmId: req.user._id, isActive: true });
    const allRoutines = await DailyRoutine.find({ smmId: req.user._id, date: targetDate });

    let totalSum = 0;
    allRoutines.forEach((r) => (totalSum += r.completionPercentage));
    const overallProgress = allAccounts.length > 0 ? Math.round(totalSum / allAccounts.length) : 0;

    return res.json({
      success: true,
      message: 'Daily progress updated!',
      routine,
      overallProgress,
    });
  } catch (error) {
    console.error('Update daily routine error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// SMM Submit Daily Work for Admin Review
exports.submitDailyWork = async (req, res) => {
  try {
    const { date, smmNotes, proofUrl, screenshotUrl } = req.body;
    const targetDate = date || getTodayString();

    const accounts = await FacebookAccount.find({ smmId: req.user._id, isActive: true });
    if (accounts.length === 0) {
      return res.status(400).json({ success: false, message: 'You have no active Facebook accounts.' });
    }

    const routines = await DailyRoutine.find({ smmId: req.user._id, date: targetDate });

    let totalPercentageSum = 0;
    let completedAccountsCount = 0;

    const accountSummaries = accounts.map((acc) => {
      const routine = routines.find((r) => r.facebookAccountId.toString() === acc._id.toString());
      const completionPercentage = routine ? routine.completionPercentage : 0;
      const isCompleted = routine ? routine.isCompleted : false;

      totalPercentageSum += completionPercentage;
      if (isCompleted) completedAccountsCount += 1;

      return {
        facebookAccountId: acc._id,
        accountName: acc.accountName,
        profileUrl: acc.profileUrl,
        avatarUrl: acc.avatarUrl,
        accountMode: acc.accountMode || 'general',
        assignedProduct: acc.assignedProduct || 'none',
        completionPercentage,
        isCompleted,
        profilePicUploaded: routine?.items?.profilePicUploaded || false,
        coverPhotoUploaded: routine?.items?.coverPhotoUploaded || false,
        maritalStatusUpdated: routine?.items?.maritalStatusUpdated || false,
        schoolCollegeUpdated: routine?.items?.schoolCollegeUpdated || false,
        identityPostDone: routine?.items?.identityPostDone || false,
        commentsCount: routine?.items?.commentsCount || 0,
        communityRepliesCount: routine?.items?.communityRepliesCount || 0,
        storyPostDone: routine?.items?.storyPostDone || false,
        feedScrollDone: routine?.items?.feedScrollDone || false,
        groupShareCount: routine?.items?.groupShareCount || 0,
        dynamicChecklist: (routine?.items?.dynamicChecklist || []).map((d) => ({
          title: d.title,
          taskType: d.taskType,
          mode: d.mode,
          isDone: d.isDone,
        })),
        notes: routine?.notes || '',
      };
    });

    const overallProgress = Math.round(totalPercentageSum / accounts.length);

    let submission = await DailyWorkSubmission.findOne({
      smmId: req.user._id,
      date: targetDate,
    });

    if (submission) {
      if (submission.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Your daily routine for this date has already been reviewed and approved.',
        });
      }

      submission.overallProgress = overallProgress;
      submission.totalAccounts = accounts.length;
      submission.completedAccountsCount = completedAccountsCount;
      submission.accountSummaries = accountSummaries;
      submission.smmNotes = smmNotes !== undefined ? smmNotes : submission.smmNotes;
      submission.proofUrl = proofUrl !== undefined ? proofUrl : submission.proofUrl;
      submission.screenshotUrl = screenshotUrl !== undefined ? screenshotUrl : submission.screenshotUrl;
      submission.status = 'pending';
      submission.adminFeedback = '';
      submission.submittedAt = new Date();
      await submission.save();
    } else {
      submission = await DailyWorkSubmission.create({
        smmId: req.user._id,
        date: targetDate,
        overallProgress,
        totalAccounts: accounts.length,
        completedAccountsCount,
        accountSummaries,
        smmNotes: smmNotes || '',
        proofUrl: proofUrl || '',
        screenshotUrl: screenshotUrl || '',
        status: 'pending',
        submittedAt: new Date(),
      });
    }

    // Real-time notification to Admins
    sendNotificationToRole('admin', {
      type: 'daily_submission',
      title: '📋 New Daily Tasks Submitted',
      message: `${req.user.name || 'SMM'} submitted daily routine for ${targetDate} (${overallProgress}% complete).`,
      link: '/verifications',
    });

    const populated = await DailyWorkSubmission.findById(submission._id).populate('smmId', 'name email avatar');

    return res.status(201).json({
      success: true,
      message: 'Daily routine submitted successfully! Awaiting Admin review & scoring.',
      submission: populated,
    });
  } catch (error) {
    console.error('Submit daily work error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin List All Daily Work Submissions
exports.listDailySubmissions = async (req, res) => {
  try {
    const { status, date, smmId } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (date) {
      filter.date = date;
    }
    if (smmId) {
      filter.smmId = smmId;
    }

    const submissions = await DailyWorkSubmission.find(filter)
      .populate('smmId', 'name email avatar rewardPoints streakDays')
      .populate('reviewedBy', 'name email')
      .sort({ date: -1, createdAt: -1 });

    const settings = await SystemSetting.getSettings();

    return res.json({
      success: true,
      count: submissions.length,
      defaultDailyCompletionReward: settings.defaultDailyCompletionReward || 100,
      scoreRules: settings.dailyTaskScoreRules || {
        score5Points: 100,
        score4Points: 80,
        score3Points: 60,
        score2Points: 40,
        score1Points: 20,
      },
      ratingBreakpoints: settings.ratingBreakpoints || [],
      submissions,
    });
  } catch (error) {
    console.error('List daily submissions error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Review Daily Work Submission (Score 1-5 & Points)
exports.reviewDailySubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reviewScore, pointsAwarded, adminFeedback } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be either 'approve' or 'reject'." });
    }

    const submission = await DailyWorkSubmission.findById(id).populate('smmId');
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Daily submission not found.' });
    }

    const smmUser = await User.findById(submission.smmId._id);
    if (!smmUser) {
      return res.status(404).json({ success: false, message: 'SMM User not found.' });
    }

    const settings = await SystemSetting.getSettings();
    const scoreRules = settings.dailyTaskScoreRules || {
      score5Points: 100,
      score4Points: 80,
      score3Points: 60,
      score2Points: 40,
      score1Points: 20,
    };

    if (action === 'approve') {
      const score = Math.min(5, Math.max(1, Number(reviewScore) || 5));
      let finalPoints = Number(pointsAwarded);

      if (isNaN(finalPoints) || finalPoints === undefined || finalPoints < 0) {
        const breakpoints = Array.isArray(settings.ratingBreakpoints) && settings.ratingBreakpoints.length > 0
          ? [...settings.ratingBreakpoints].sort((a, b) => b.minRating - a.minRating)
          : [];

        if (breakpoints.length > 0) {
          const matched = breakpoints.find((bp) => score >= bp.minRating - 0.05);
          finalPoints = matched ? matched.points : (breakpoints[breakpoints.length - 1]?.points || 0);
        } else {
          const ruleKey = `score${score}Points`;
          finalPoints = scoreRules[ruleKey] !== undefined ? scoreRules[ruleKey] : Math.round((score / 5) * (settings.defaultDailyCompletionReward || 100));
        }
      }

      // Only award points if not already approved
      if (submission.status !== 'approved') {
        smmUser.rewardPoints += finalPoints;
        if (smmUser.lastDailyRewardDate !== submission.date) {
          smmUser.streakDays = (smmUser.streakDays || 0) + 1;
          smmUser.lastDailyRewardDate = submission.date;
          smmUser.lastActiveDate = submission.date;
        }
        await smmUser.save();

        await PointTransaction.create({
          userId: smmUser._id,
          amount: finalPoints,
          type: 'daily_bonus',
          description: `Daily task reward for ${submission.date} (Review Score: ${score}/5 ⭐ - ${finalPoints} PTS)`,
          referenceId: submission._id,
          balanceAfter: smmUser.rewardPoints,
        });
      }

      submission.status = 'approved';
      submission.reviewScore = score;
      submission.pointsAwarded = finalPoints;
      submission.adminFeedback = adminFeedback ? adminFeedback.trim() : 'Approved by Admin';
      submission.reviewedBy = req.user._id;
      submission.reviewedAt = new Date();
      await submission.save();

      // Emit real-time notification to SMM
      sendNotificationToUser(smmUser._id, {
        type: 'daily_reward',
        title: '🏆 Daily Routine Evaluated & Rewarded!',
        message: `Your daily tasks for ${submission.date} were reviewed! Score: ${score}/5 ⭐ (+${finalPoints} PTS credited).`,
        link: '/daily',
        points: finalPoints,
      });

      return res.json({
        success: true,
        message: `Daily submission approved! ${finalPoints} PTS (Score: ${score}/5) awarded to ${smmUser.name}.`,
        submission,
      });
    } else {
      // Reject / Revision Requested
      if (!adminFeedback || adminFeedback.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Please provide feedback/instructions so the SMM agent knows what to fix.',
        });
      }

      submission.status = 'rejected';
      submission.adminFeedback = adminFeedback.trim();
      submission.reviewedBy = req.user._id;
      submission.reviewedAt = new Date();
      await submission.save();

      // Emit real-time notification to SMM
      sendNotificationToUser(smmUser._id, {
        type: 'daily_rejected',
        title: '⚠️ Daily Routine Revision Required',
        message: `Your daily tasks for ${submission.date} need updates: "${adminFeedback.trim()}".`,
        link: '/daily',
      });

      return res.json({
        success: true,
        message: 'Daily submission rejected with revision feedback.',
        submission,
      });
    }
  } catch (error) {
    console.error('Review daily submission error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin manually trigger midnight daily task evaluation (for testing or date backfill)
exports.triggerMidnightDailyRewards = async (req, res) => {
  try {
    const { processDailyMidnightRewards } = require('../services/dailyRewardCronService');
    const { date } = req.body;
    const result = await processDailyMidnightRewards(date);
    return res.json({
      success: true,
      message: `Midnight daily rewards evaluation processed for ${result.date || 'yesterday'} (${result.rewardedCount || 0} SMMs rewarded).`,
      result,
    });
  } catch (error) {
    console.error('Trigger midnight daily rewards error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

