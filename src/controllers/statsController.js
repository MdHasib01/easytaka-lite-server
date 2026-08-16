const User = require('../models/User');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const FacebookAccount = require('../models/FacebookAccount');
const PointTransaction = require('../models/PointTransaction');
const DailyRoutine = require('../models/DailyRoutine');

const getTodayString = () => new Date().toISOString().split('T')[0];

exports.getDashboardStats = async (req, res) => {
  try {
    const today = getTodayString();

    if (req.user.role === 'admin') {
      const [
        totalSmms,
        totalTasks,
        activeTasks,
        pendingTaskVerifications,
        pendingAccountVerifications,
        pendingSmmVerifications,
        totalAccounts,
        recentSubmissions,
      ] = await Promise.all([
        User.countDocuments({ role: 'smm', isActive: true }),
        Task.countDocuments(),
        Task.countDocuments({ status: 'active' }),
        TaskSubmission.countDocuments({ status: 'pending' }),
        FacebookAccount.countDocuments({ approvalStatus: 'pending', isActive: true }),
        User.countDocuments({ role: 'smm', status: 'pending_verification' }),
        FacebookAccount.countDocuments({ isActive: true }),
        TaskSubmission.find()
          .sort({ createdAt: -1 })
          .limit(6)
          .populate('smmId', 'name email avatar')
          .populate('taskId', 'title rewardPoints taskType'),
      ]);

      const pendingVerifications = pendingTaskVerifications + pendingAccountVerifications + pendingSmmVerifications;

      // Total points awarded
      const pointAggregation = await PointTransaction.aggregate([
        { $match: { amount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const totalPointsAwarded = pointAggregation[0]?.total || 0;

      return res.json({
        success: true,
        stats: {
          totalSmms,
          totalTasks,
          activeTasks,
          pendingVerifications,
          pendingTaskVerifications,
          pendingAccountVerifications,
          pendingSmmVerifications,
          totalAccounts,
          totalPointsAwarded,
        },
        recentSubmissions,
      });
    } else {
      // SMM Dashboard Stats
      const smmId = req.user._id;

      const [
        myAccountsCount,
        myPendingSubmissions,
        myApprovedSubmissions,
        myRejectedSubmissions,
        todayRoutines,
        recentTransactions,
      ] = await Promise.all([
        FacebookAccount.countDocuments({ smmId, isActive: true }),
        TaskSubmission.countDocuments({ smmId, status: 'pending' }),
        TaskSubmission.countDocuments({ smmId, status: 'approved' }),
        TaskSubmission.countDocuments({ smmId, status: 'rejected' }),
        DailyRoutine.find({ smmId, date: today }),
        PointTransaction.find({ userId: smmId }).sort({ createdAt: -1 }).limit(5),
      ]);

      let totalProgressSum = 0;
      todayRoutines.forEach((r) => (totalProgressSum += r.completionPercentage));
      const dailyProgress = myAccountsCount > 0 ? Math.round(totalProgressSum / myAccountsCount) : 0;

      return res.json({
        success: true,
        stats: {
          rewardPoints: req.user.rewardPoints,
          dailyProgress,
          myAccountsCount,
          pendingSubmissions: myPendingSubmissions,
          approvedSubmissions: myApprovedSubmissions,
          rejectedSubmissions: myRejectedSubmissions,
          streakDays: req.user.streakDays || 0,
        },
        recentTransactions,
      });
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// SMM Leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const smms = await User.find({ role: 'smm', isActive: true })
      .select('name email avatar rewardPoints streakDays createdAt')
      .sort({ rewardPoints: -1 })
      .limit(20);

    // Attach completed tasks count
    const enriched = await Promise.all(
      smms.map(async (smm, idx) => {
        const completedTasks = await TaskSubmission.countDocuments({ smmId: smm._id, status: 'approved' });
        const managedAccounts = await FacebookAccount.countDocuments({ smmId: smm._id, isActive: true });
        return {
          rank: idx + 1,
          id: smm._id,
          name: smm.name,
          email: smm.email,
          avatar: smm.avatar,
          rewardPoints: smm.rewardPoints,
          streakDays: smm.streakDays || 0,
          completedTasks,
          managedAccounts,
        };
      })
    );

    return res.json({ success: true, leaderboard: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// SMM Point Ledger
exports.getPointHistory = async (req, res) => {
  try {
    const transactions = await PointTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ success: true, balance: req.user.rewardPoints, transactions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
