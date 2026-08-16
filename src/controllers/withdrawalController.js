const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const SystemSetting = require('../models/SystemSetting');
const TaskSubmission = require('../models/TaskSubmission');
const FacebookAccount = require('../models/FacebookAccount');
const { sendNotificationToUser, sendNotificationToRole } = require('../socket');

/**
 * Clean & normalize Bangladeshi phone numbers
 */
const normalizeBkashNumber = (number) => {
  if (!number) return '';
  let cleaned = String(number).trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+88')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
};

/**
 * Validate Bangladeshi mobile number (013, 014, 015, 016, 017, 018, 019 - 11 digits)
 */
const isValidBdMobile = (number) => {
  const cleaned = normalizeBkashNumber(number);
  return /^01[3-9]\d{8}$/.test(cleaned);
};

/**
 * Get SMM 7-Day Cycle and Redemption Eligibility Status
 */
exports.getEligibility = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const settings = await SystemSetting.getSettings();
    const cycleDays = settings.withdrawalCycleDays || 7;
    const minWithdrawalPoints = settings.minWithdrawalPoints || 50;
    const maxWithdrawalPoints = settings.maxWithdrawalPoints || 1000;
    const pointToBdtRate = settings.pointToBdtRate || 1;
    const withdrawalEnabled = settings.withdrawalEnabled !== false;

    const now = new Date();
    const joinDate = user.createdAt ? new Date(user.createdAt) : new Date();

    // Calculate days since user joined
    const msSinceJoin = Math.max(0, now.getTime() - joinDate.getTime());
    const daysSinceJoin = Math.floor(msSinceJoin / (1000 * 60 * 60 * 24));

    // Calculate 7-day cycle position
    const currentCycleNumber = Math.floor(daysSinceJoin / cycleDays) + 1;
    const daysInCurrentCycle = daysSinceJoin % cycleDays;
    const daysUntilNextCycle = daysInCurrentCycle === 0 && daysSinceJoin > 0 ? 0 : cycleDays - daysInCurrentCycle;

    // Check last non-rejected withdrawal
    const lastWithdrawal = await Withdrawal.findOne({
      userId: user._id,
      status: { $ne: 'rejected' },
    }).sort({ createdAt: -1 });

    let daysSinceLastWithdrawal = null;
    if (lastWithdrawal) {
      const msSinceLast = Math.max(0, now.getTime() - new Date(lastWithdrawal.createdAt).getTime());
      daysSinceLastWithdrawal = Math.floor(msSinceLast / (1000 * 60 * 60 * 24));
    }

    // Check work activity stats
    const [approvedTasksCount, approvedAccountsCount, pendingWithdrawalsCount] = await Promise.all([
      TaskSubmission.countDocuments({ smmId: user._id, status: 'approved' }),
      FacebookAccount.countDocuments({ smmId: user._id, approvalStatus: 'approved', isActive: true }),
      Withdrawal.countDocuments({ userId: user._id, status: 'pending' }),
    ]);

    const hasWorkActivity = approvedTasksCount > 0 || approvedAccountsCount > 0 || (user.rewardPoints || 0) > 0;
    const hasSufficientPoints = (user.rewardPoints || 0) >= minWithdrawalPoints;

    // 7-day rule check:
    // 1. Must be joined for at least cycleDays (7 days), OR
    // 2. If already withdrawn before, must be at least cycleDays (7 days) since previous withdrawal
    const isJoinCycleEligible = daysSinceJoin >= cycleDays;
    const isLastWithdrawalCycleEligible = daysSinceLastWithdrawal === null || daysSinceLastWithdrawal >= cycleDays;

    const isCycleEligible = isJoinCycleEligible && isLastWithdrawalCycleEligible;

    let isEligible = withdrawalEnabled && isCycleEligible && hasSufficientPoints && hasWorkActivity;
    let ineligibleReason = '';

    if (!withdrawalEnabled) {
      ineligibleReason = 'Point redemption is temporarily paused for maintenance.';
    } else if (!isJoinCycleEligible) {
      const remaining = cycleDays - daysSinceJoin;
      ineligibleReason = `You can redeem every 7 days from your join date. ${remaining} day${remaining > 1 ? 's' : ''} remaining until your first redemption window opens.`;
    } else if (!isLastWithdrawalCycleEligible) {
      const remaining = cycleDays - daysSinceLastWithdrawal;
      ineligibleReason = `You can redeem every 7 days. ${remaining} day${remaining > 1 ? 's' : ''} remaining since your last withdrawal.`;
    } else if (!hasSufficientPoints) {
      ineligibleReason = `Minimum withdrawal amount is ${minWithdrawalPoints} Points (৳${minWithdrawalPoints * pointToBdtRate} BDT). Your balance is ${user.rewardPoints || 0} Points.`;
    } else if (!hasWorkActivity) {
      ineligibleReason = 'Complete tasks or register verified Facebook accounts to earn points and qualify for withdrawal.';
    }

    // Calculate next eligible date
    let nextEligibleDate = new Date(joinDate);
    if (!isJoinCycleEligible) {
      nextEligibleDate.setDate(nextEligibleDate.getDate() + cycleDays);
    } else if (lastWithdrawal && !isLastWithdrawalCycleEligible) {
      nextEligibleDate = new Date(lastWithdrawal.createdAt);
      nextEligibleDate.setDate(nextEligibleDate.getDate() + cycleDays);
    } else {
      nextEligibleDate = now;
    }

    return res.json({
      success: true,
      eligibility: {
        isEligible,
        ineligibleReason,
        currentPoints: user.rewardPoints || 0,
        equivalentBDT: (user.rewardPoints || 0) * pointToBdtRate,
        minWithdrawalPoints,
        minWithdrawalBDT: minWithdrawalPoints * pointToBdtRate,
        maxWithdrawalPoints,
        maxWithdrawalBDT: maxWithdrawalPoints * pointToBdtRate,
        pointToBdtRate,
        joinDate: user.createdAt,
        daysSinceJoin,
        cycleDays,
        currentCycleNumber,
        daysInCurrentCycle,
        daysUntilNextCycle,
        nextEligibleDate,
        lastWithdrawalDate: lastWithdrawal ? lastWithdrawal.createdAt : null,
        daysSinceLastWithdrawal,
        pendingWithdrawalsCount,
        workStats: {
          approvedTasksCount,
          approvedAccountsCount,
          streakDays: user.streakDays || 0,
          hasWorkActivity,
        },
      },
    });
  } catch (error) {
    console.error('Get withdrawal eligibility error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submit a new Point Redemption / bKash Withdrawal Request
 */
exports.createWithdrawal = async (req, res) => {
  try {
    const { points, accountNumber, accountType = 'personal', paymentMethod = 'bkash' } = req.body;

    const pointsNum = Number(points);
    if (!pointsNum || isNaN(pointsNum) || pointsNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid positive number of points to withdraw.',
      });
    }

    const settings = await SystemSetting.getSettings();
    if (settings.withdrawalEnabled === false) {
      return res.status(400).json({
        success: false,
        message: 'Point redemption is currently paused by the administrator.',
      });
    }

    const minPoints = settings.minWithdrawalPoints || 50;
    const maxPoints = settings.maxWithdrawalPoints || 1000;

    if (pointsNum < minPoints) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ${minPoints} Points (৳${minPoints * (settings.pointToBdtRate || 1)} BDT).`,
      });
    }

    if (pointsNum > maxPoints) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal limit per request is ${maxPoints} Points (৳${maxPoints * (settings.pointToBdtRate || 1)} BDT).`,
      });
    }

    const cleanedNumber = normalizeBkashNumber(accountNumber);
    if (!isValidBdMobile(cleanedNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 11-digit Bangladeshi bKash number (e.g. 017XXXXXXXX, 018XXXXXXXX).',
      });
    }

    // Atomic user fetch and balance check
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.rewardPoints < pointsNum) {
      return res.status(400).json({
        success: false,
        message: `Insufficient points balance. You have ${user.rewardPoints} points available.`,
      });
    }

    // 7-Day Cycle Verification
    const cycleDays = settings.withdrawalCycleDays || 7;
    const now = new Date();
    const joinDate = user.createdAt ? new Date(user.createdAt) : now;
    const daysSinceJoin = Math.floor(Math.max(0, now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

    const lastWithdrawal = await Withdrawal.findOne({
      userId: user._id,
      status: { $ne: 'rejected' },
    }).sort({ createdAt: -1 });

    let daysSinceLastWithdrawal = null;
    if (lastWithdrawal) {
      daysSinceLastWithdrawal = Math.floor(
        Math.max(0, now.getTime() - new Date(lastWithdrawal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // If user has not reached 7 days since join (and not admin bypass), inform them
    if (daysSinceJoin < cycleDays && req.user.role !== 'admin') {
      const remaining = cycleDays - daysSinceJoin;
      return res.status(400).json({
        success: false,
        message: `Redemptions are eligible every 7 days from your join date. ${remaining} day${remaining > 1 ? 's' : ''} remaining until your cashout window opens.`,
      });
    }

    // If user made a withdrawal less than 7 days ago
    if (daysSinceLastWithdrawal !== null && daysSinceLastWithdrawal < cycleDays && req.user.role !== 'admin') {
      const remaining = cycleDays - daysSinceLastWithdrawal;
      return res.status(400).json({
        success: false,
        message: `You can redeem once every 7 days. ${remaining} day${remaining > 1 ? 's' : ''} remaining since your previous withdrawal.`,
      });
    }

    const [approvedTasksCount, approvedAccountsCount] = await Promise.all([
      TaskSubmission.countDocuments({ smmId: user._id, status: 'approved' }),
      FacebookAccount.countDocuments({ smmId: user._id, approvalStatus: 'approved', isActive: true }),
    ]);

    const rate = settings.pointToBdtRate || 1;
    const amountBDT = Math.round(pointsNum * rate);

    // Deduct points from user
    user.rewardPoints -= pointsNum;
    await user.save();

    // Create Withdrawal Record
    const withdrawal = await Withdrawal.create({
      userId: user._id,
      points: pointsNum,
      amountBDT,
      paymentMethod: 'bkash',
      accountNumber: cleanedNumber,
      accountType: ['personal', 'agent', 'merchant'].includes(accountType) ? accountType : 'personal',
      status: 'pending',
      cycleInfo: {
        joinDate: user.createdAt,
        daysSinceJoin,
        cycleNumber: Math.floor(daysSinceJoin / cycleDays) + 1,
        isEligible: true,
        approvedTasksCount,
        approvedAccountsCount,
      },
    });

    // Record Point Ledger Transaction
    await PointTransaction.create({
      userId: user._id,
      amount: -pointsNum,
      type: 'withdrawal',
      description: `bKash Cashout Request: ৳${amountBDT} BDT (${cleanedNumber})`,
      referenceId: withdrawal._id,
      balanceAfter: user.rewardPoints,
    });

    // Realtime Notification for Admins
    sendNotificationToRole('admin', {
      type: 'withdrawal_requested',
      title: '💸 New bKash Withdrawal Request',
      message: `${user.name || 'SMM Agent'} requested ৳${amountBDT} BDT (${pointsNum} PTS) to bKash (${cleanedNumber}).`,
      link: '/withdraw',
      points: pointsNum,
      metadata: {
        withdrawalId: withdrawal._id,
        accountNumber: cleanedNumber,
        amountBDT,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Withdrawal request for ৳${amountBDT} BDT (${pointsNum} Points) submitted successfully via bKash! Admin will process your payment.`,
      withdrawal,
      balanceAfter: user.rewardPoints,
    });
  } catch (error) {
    console.error('Create withdrawal error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get SMM User's Own Withdrawal History
 */
exports.getMyWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    console.error('Get my withdrawals error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get All Withdrawals (Admin Only) with filtering & search
 */
exports.getAllWithdrawals = async (req, res) => {
  try {
    const { status, search, limit = 100, page = 1 } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchedUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      }).select('_id');

      const userIds = matchedUsers.map((u) => u._id);

      query.$or = [{ accountNumber: searchRegex }, { transactionId: searchRegex }, { userId: { $in: userIds } }];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [withdrawals, totalCount] = await Promise.all([
      Withdrawal.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email avatar phone rewardPoints streakDays createdAt')
        .populate('processedBy', 'name email'),
      Withdrawal.countDocuments(query),
    ]);

    return res.json({
      success: true,
      withdrawals,
      totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (error) {
    console.error('Get all withdrawals error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update Withdrawal Status: Approve & Pay (with bKash TrxID) OR Reject (with auto-refund)
 */
exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, transactionId, adminNote } = req.body;

    if (!['approve', 'pay', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve", "pay", or "reject".',
      });
    }

    const withdrawal = await Withdrawal.findById(id).populate('userId');
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    if (withdrawal.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This withdrawal has already been paid and completed.',
      });
    }

    if (withdrawal.status === 'rejected' && action === 'reject') {
      return res.status(400).json({
        success: false,
        message: 'This withdrawal has already been rejected.',
      });
    }

    const smmUser = await User.findById(withdrawal.userId._id);
    if (!smmUser) {
      return res.status(404).json({ success: false, message: 'Associated SMM user not found' });
    }

    if (action === 'pay' || action === 'approve') {
      withdrawal.status = 'paid';
      withdrawal.transactionId = transactionId ? transactionId.trim() : (withdrawal.transactionId || 'BKASH-MANUAL');
      withdrawal.adminNote = adminNote ? adminNote.trim() : 'Payment sent via bKash';
      withdrawal.processedBy = req.user._id;
      withdrawal.processedAt = new Date();
      await withdrawal.save();

      // Notify SMM User via real-time WebSocket and Notification model
      sendNotificationToUser(smmUser._id, {
        type: 'withdrawal_paid',
        title: '🎉 bKash Cashout Paid!',
        message: `Your withdrawal of ৳${withdrawal.amountBDT} BDT has been sent to bKash ${withdrawal.accountNumber}. TrxID: ${withdrawal.transactionId}`,
        link: '/withdraw',
        points: withdrawal.points,
        metadata: {
          withdrawalId: withdrawal._id,
          transactionId: withdrawal.transactionId,
          amountBDT: withdrawal.amountBDT,
          accountNumber: withdrawal.accountNumber,
        },
      });

      return res.json({
        success: true,
        message: `Withdrawal of ৳${withdrawal.amountBDT} marked as PAID via bKash (TrxID: ${withdrawal.transactionId}).`,
        withdrawal,
      });
    } else {
      // REJECT: Auto-refund points back to SMM user wallet
      const reason = adminNote ? adminNote.trim() : 'Withdrawal rejected by administrator';

      withdrawal.status = 'rejected';
      withdrawal.adminNote = reason;
      withdrawal.processedBy = req.user._id;
      withdrawal.processedAt = new Date();
      await withdrawal.save();

      // Refund points to user
      smmUser.rewardPoints += withdrawal.points;
      await smmUser.save();

      // Create Refund Point Transaction
      await PointTransaction.create({
        userId: smmUser._id,
        amount: withdrawal.points,
        type: 'withdrawal_refund',
        description: `Refund for rejected bKash cashout (#${withdrawal._id.toString().slice(-6)}): ${reason}`,
        referenceId: withdrawal._id,
        balanceAfter: smmUser.rewardPoints,
      });

      // Notify SMM User of rejection and refund
      sendNotificationToUser(smmUser._id, {
        type: 'withdrawal_rejected',
        title: '❌ Withdrawal Request Rejected',
        message: `Your withdrawal request for ৳${withdrawal.amountBDT} BDT (${withdrawal.points} PTS) was rejected: "${reason}". +${withdrawal.points} PTS refunded to your wallet.`,
        link: '/withdraw',
        points: withdrawal.points,
        metadata: {
          withdrawalId: withdrawal._id,
          reason,
          refundedPoints: withdrawal.points,
        },
      });

      return res.json({
        success: true,
        message: `Withdrawal rejected. ${withdrawal.points} points have been refunded to ${smmUser.name}'s wallet.`,
        withdrawal,
      });
    }
  } catch (error) {
    console.error('Update withdrawal status error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Withdrawal Analytics & Overview Stats
 */
exports.getWithdrawalStats = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const [
        totalPendingCount,
        totalPaidCount,
        totalRejectedCount,
        totalPaidBDTResult,
        totalPendingBDTResult,
        recentRequests,
      ] = await Promise.all([
        Withdrawal.countDocuments({ status: 'pending' }),
        Withdrawal.countDocuments({ status: 'paid' }),
        Withdrawal.countDocuments({ status: 'rejected' }),
        Withdrawal.aggregate([
          { $match: { status: 'paid' } },
          { $group: { _id: null, totalBDT: { $sum: '$amountBDT' }, totalPoints: { $sum: '$points' } } },
        ]),
        Withdrawal.aggregate([
          { $match: { status: 'pending' } },
          { $group: { _id: null, totalBDT: { $sum: '$amountBDT' }, totalPoints: { $sum: '$points' } } },
        ]),
        Withdrawal.find({ status: 'pending' })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('userId', 'name email avatar phone'),
      ]);

      const totalPaidBDT = totalPaidBDTResult[0]?.totalBDT || 0;
      const totalPaidPoints = totalPaidBDTResult[0]?.totalPoints || 0;
      const totalPendingBDT = totalPendingBDTResult[0]?.totalBDT || 0;
      const totalPendingPoints = totalPendingBDTResult[0]?.totalPoints || 0;

      return res.json({
        success: true,
        stats: {
          totalPendingCount,
          totalPaidCount,
          totalRejectedCount,
          totalPaidBDT,
          totalPaidPoints,
          totalPendingBDT,
          totalPendingPoints,
        },
        recentRequests,
      });
    } else {
      // SMM User stats
      const userId = req.user._id;
      const [myPendingCount, myPaidCount, myPaidBDTResult, myPendingBDTResult] = await Promise.all([
        Withdrawal.countDocuments({ userId, status: 'pending' }),
        Withdrawal.countDocuments({ userId, status: 'paid' }),
        Withdrawal.aggregate([
          { $match: { userId, status: 'paid' } },
          { $group: { _id: null, totalBDT: { $sum: '$amountBDT' }, totalPoints: { $sum: '$points' } } },
        ]),
        Withdrawal.aggregate([
          { $match: { userId, status: 'pending' } },
          { $group: { _id: null, totalBDT: { $sum: '$amountBDT' }, totalPoints: { $sum: '$points' } } },
        ]),
      ]);

      const totalPaidBDT = myPaidBDTResult[0]?.totalBDT || 0;
      const totalPaidPoints = myPaidBDTResult[0]?.totalPoints || 0;
      const totalPendingBDT = myPendingBDTResult[0]?.totalBDT || 0;
      const totalPendingPoints = myPendingBDTResult[0]?.totalPoints || 0;

      return res.json({
        success: true,
        stats: {
          myPendingCount,
          myPaidCount,
          totalPaidBDT,
          totalPaidPoints,
          totalPendingBDT,
          totalPendingPoints,
        },
      });
    }
  } catch (error) {
    console.error('Get withdrawal stats error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
