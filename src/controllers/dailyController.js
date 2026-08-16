const DailyRoutine = require('../models/DailyRoutine');
const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const SystemSetting = require('../models/SystemSetting');

const getTodayString = () => {
  const d = new Date();
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

// Calculate percentage for a daily routine doc
const computePercentage = (routine, account) => {
  const targets = account.routineTargets || {
    feedComments: 5,
    communityReplies: 3,
    storyPost: true,
    groupShare: 2,
    feedScrollMinutes: 10,
  };

  let totalWeight = 0;
  let earnedWeight = 0;

  // 1. Comments
  if (targets.feedComments > 0) {
    totalWeight += 25;
    const ratio = Math.min(1, (routine.items.commentsCount || 0) / targets.feedComments);
    earnedWeight += ratio * 25;
  }

  // 2. Community Replies
  if (targets.communityReplies > 0) {
    totalWeight += 25;
    const ratio = Math.min(1, (routine.items.communityRepliesCount || 0) / targets.communityReplies);
    earnedWeight += ratio * 25;
  }

  // 3. Story Post
  if (targets.storyPost) {
    totalWeight += 20;
    if (routine.items.storyPostDone) earnedWeight += 20;
  }

  // 4. Group Share
  if (targets.groupShare > 0) {
    totalWeight += 15;
    const ratio = Math.min(1, (routine.items.groupShareCount || 0) / targets.groupShare);
    earnedWeight += ratio * 15;
  }

  // 5. Feed Scroll
  totalWeight += 15;
  if (routine.items.feedScrollDone) earnedWeight += 15;

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

    const dailyReward = user?.dailyTaskCompletionReward !== undefined 
      ? user.dailyTaskCompletionReward 
      : (settings.defaultDailyCompletionReward || 50);

    const dailyRewardClaimedToday = user?.lastDailyRewardDate === targetDate;

    if (accounts.length === 0) {
      return res.json({
        success: true,
        date: targetDate,
        totalAccounts: 0,
        overallProgress: 0,
        completedAccountsCount: 0,
        dailyTaskCompletionReward: dailyReward,
        dailyRewardClaimedToday,
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

      if (!routine) {
        routine = await DailyRoutine.create({
          smmId: req.user._id,
          facebookAccountId: account._id,
          date: targetDate,
          items: {
            feedScrollDone: false,
            commentsCount: 0,
            communityRepliesCount: 0,
            storyPostDone: false,
            groupShareCount: 0,
            customChecklist: [],
          },
          completionPercentage: 0,
          isCompleted: false,
        });
      }

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
      dailyTaskCompletionReward: dailyReward,
      dailyRewardClaimedToday,
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
      if (updates.feedScrollDone !== undefined) routine.items.feedScrollDone = updates.feedScrollDone;
      if (updates.commentsCount !== undefined) routine.items.commentsCount = Math.max(0, updates.commentsCount);
      if (updates.communityRepliesCount !== undefined)
        routine.items.communityRepliesCount = Math.max(0, updates.communityRepliesCount);
      if (updates.storyPostDone !== undefined) routine.items.storyPostDone = updates.storyPostDone;
      if (updates.groupShareCount !== undefined) routine.items.groupShareCount = Math.max(0, updates.groupShareCount);
      if (updates.customChecklist !== undefined) routine.items.customChecklist = updates.customChecklist;
      if (updates.notes !== undefined) routine.notes = updates.notes;
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

    let dailyRewardAwarded = false;
    let dailyRewardAmount = 0;

    // Check if 100% completed today and reward not yet claimed for targetDate
    if (overallProgress === 100) {
      const user = await User.findById(req.user._id);
      if (user && user.lastDailyRewardDate !== targetDate) {
        const settings = await SystemSetting.getSettings();
        dailyRewardAmount = user.dailyTaskCompletionReward !== undefined && user.dailyTaskCompletionReward > 0
          ? user.dailyTaskCompletionReward
          : (settings.defaultDailyCompletionReward || 50);

        user.rewardPoints += dailyRewardAmount;
        user.streakDays = (user.streakDays || 0) + 1;
        user.lastActiveDate = targetDate;
        user.lastDailyRewardDate = targetDate;
        await user.save();

        await PointTransaction.create({
          userId: user._id,
          amount: dailyRewardAmount,
          type: 'daily_bonus',
          description: `Daily task completion reward for ${targetDate} (100% completed)`,
          balanceAfter: user.rewardPoints,
        });

        dailyRewardAwarded = true;
      }
    }

    return res.json({
      success: true,
      message: dailyRewardAwarded
        ? `🎉 Incredible! You completed all daily tasks and earned +${dailyRewardAmount} PTS!`
        : 'Daily progress updated!',
      routine,
      overallProgress,
      dailyRewardAwarded,
      dailyRewardAmount,
    });
  } catch (error) {
    console.error('Update daily routine error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
