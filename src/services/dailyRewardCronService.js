const cron = require('node-cron');
const User = require('../models/User');
const FacebookAccount = require('../models/FacebookAccount');
const DailyRoutine = require('../models/DailyRoutine');
const DailyWorkSubmission = require('../models/DailyWorkSubmission');
const TaskSubmission = require('../models/TaskSubmission');
const PointTransaction = require('../models/PointTransaction');
const SystemSetting = require('../models/SystemSetting');
const { sendNotificationToUser, sendNotificationToRole } = require('../socket');

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

const getTodayString = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

/**
 * Evaluates all SMMs' daily task completions and average ratings for a target date
 * and distributes the global daily reward points accordingly.
 * @param {string} [targetDate] - Optional date in YYYY-MM-DD format (defaults to yesterday)
 */
const processDailyMidnightRewards = async (targetDate) => {
  const date = targetDate || getYesterdayString();
  console.log(`[DailyRewardCron] 🕛 Running midnight daily reward evaluation for date: ${date}`);

  try {
    const settings = await SystemSetting.getSettings();
    const maxReward = settings.defaultDailyCompletionReward || 100;
    const scoreRules = settings.dailyTaskScoreRules || {
      score5Points: 100,
      score4Points: 80,
      score3Points: 60,
      score2Points: 40,
      score1Points: 20,
    };

    const smms = await User.find({ role: 'smm', isActive: true, status: 'active' });
    const rewardedUsers = [];

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    for (const smm of smms) {
      // Skip if already rewarded for this date
      if (smm.lastDailyRewardDate === date) {
        continue;
      }

      // 1. Check Daily Routines across active FB accounts
      const accounts = await FacebookAccount.find({ smmId: smm._id, isActive: true });
      const routines = await DailyRoutine.find({ smmId: smm._id, date });

      let totalPctSum = 0;
      routines.forEach((r) => {
        totalPctSum += r.completionPercentage || 0;
      });
      const overallProgress = accounts.length > 0 ? Math.round(totalPctSum / accounts.length) : 0;

      // 2. Check Daily Work Submission
      const dailySub = await DailyWorkSubmission.findOne({ smmId: smm._id, date });

      // 3. Check Task Proof Submissions for that date
      const taskSubs = await TaskSubmission.find({
        smmId: smm._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

      const approvedTaskSubs = taskSubs.filter((t) => t.status === 'approved');

      // Check if user completed their tasks for the day
      const hasCompletedRoutine = overallProgress >= 80 || (dailySub && dailySub.status === 'approved');
      const hasApprovedTasks = approvedTaskSubs.length > 0;

      // Only reward if user actively participated and completed tasks
      if (!hasCompletedRoutine && !hasApprovedTasks) {
        continue;
      }

      // Collect all ratings for the day
      const ratings = [];

      // Add ratings from approved individual task proofs
      approvedTaskSubs.forEach((t) => {
        if (t.rating && t.rating >= 1 && t.rating <= 5) {
          ratings.push(t.rating);
        } else {
          ratings.push(5);
        }
      });

      // Add review score from daily work submission if reviewed
      if (dailySub && dailySub.reviewScore && dailySub.reviewScore >= 1) {
        ratings.push(dailySub.reviewScore);
      }

      // Fallback if no specific rating given but checklist was completed
      if (ratings.length === 0) {
        if (overallProgress >= 100) {
          ratings.push(5);
        } else {
          ratings.push(Math.max(1, Math.min(5, Math.round((overallProgress / 100) * 5))));
        }
      }

      // Calculate Average Rating
      const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      const roundedScore = Math.min(5, Math.max(1, Math.round(avgRating)));

      // Calculate Points Awarded based on rating breakpoints or fallback score rules
      let points = 0;
      const breakpoints = Array.isArray(settings.ratingBreakpoints) && settings.ratingBreakpoints.length > 0
        ? [...settings.ratingBreakpoints].sort((a, b) => b.minRating - a.minRating)
        : [];

      if (breakpoints.length > 0) {
        // Find highest breakpoint satisfied (with 0.05 tolerance for floating-point comparisons)
        const matched = breakpoints.find((bp) => avgRating >= (bp.minRating - 0.05));
        if (matched) {
          points = matched.points;
        } else {
          // If below all defined breakpoints
          const lowest = breakpoints[breakpoints.length - 1];
          points = lowest ? lowest.points : 0;
        }
      } else {
        const ruleKey = `score${roundedScore}Points`;
        points =
          scoreRules[ruleKey] !== undefined
            ? scoreRules[ruleKey]
            : Math.round((avgRating / 5) * maxReward);
      }

      // Award points & update streak
      smm.rewardPoints = (smm.rewardPoints || 0) + points;
      smm.streakDays = (smm.streakDays || 0) + 1;
      smm.lastDailyRewardDate = date;
      smm.lastActiveDate = date;
      await smm.save();

      // Log Point Transaction
      await PointTransaction.create({
        userId: smm._id,
        amount: points,
        type: 'daily_bonus',
        description: `Midnight daily task reward for ${date} (Avg Rating: ${avgRating.toFixed(1)}/5 ⭐ - ${points} PTS)`,
        balanceAfter: smm.rewardPoints,
      });

      // Update DailyWorkSubmission if exists
      if (dailySub) {
        dailySub.status = 'approved';
        dailySub.reviewScore = roundedScore;
        dailySub.pointsAwarded = points;
        if (!dailySub.reviewedAt) dailySub.reviewedAt = new Date();
        await dailySub.save();
      }

      // Emit real-time notification to SMM
      sendNotificationToUser(smm._id, {
        type: 'daily_reward',
        title: '🏆 Daily Task Reward Credited!',
        message: `Your daily tasks for ${date} were evaluated at midnight. Average Rating: ${avgRating.toFixed(1)}/5 ⭐ (+${points} PTS credited).`,
        link: '/daily',
        points,
      });

      rewardedUsers.push({
        smmId: smm._id,
        name: smm.name,
        email: smm.email,
        avgRating: Number(avgRating.toFixed(2)),
        score: roundedScore,
        points,
      });
    }

    console.log(
      `[DailyRewardCron] ✅ Midnight evaluation completed for ${date}. Rewarded ${rewardedUsers.length} SMMs.`
    );

    // Notify Admins
    if (rewardedUsers.length > 0) {
      sendNotificationToRole('admin', {
        type: 'daily_reward_summary',
        title: '🕛 Midnight Daily Rewards Distributed',
        message: `Distributed daily points to ${rewardedUsers.length} SMMs for ${date} based on average task ratings.`,
        link: '/verifications',
      });
    }

    return {
      success: true,
      date,
      rewardedCount: rewardedUsers.length,
      rewardedUsers,
    };
  } catch (error) {
    console.error('[DailyRewardCron] Error during midnight reward evaluation:', error);
    return { success: false, error: error.message };
  }
};

let scheduledCronTask = null;

const startDailyRewardCron = () => {
  // Runs every day at 12:00 AM (00:00)
  scheduledCronTask = cron.schedule(
    '0 0 * * *',
    async () => {
      console.log('[DailyRewardCron] Triggering scheduled midnight daily task evaluation...');
      await processDailyMidnightRewards();
    },
    {
      timezone: process.env.TIMEZONE || 'Asia/Dhaka',
    }
  );

  console.log('[DailyRewardCron] 🕒 Midnight Daily Reward Cron Job initialized (runs every day at 12:00 AM)');
};

module.exports = {
  startDailyRewardCron,
  processDailyMidnightRewards,
};
