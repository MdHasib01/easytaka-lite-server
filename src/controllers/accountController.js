const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const SystemSetting = require('../models/SystemSetting');
const { sendNotificationToUser, sendNotificationToRole } = require('../socket');

// Create a new Facebook account record (SMM or Admin)
exports.createAccount = async (req, res) => {
  try {
    const {
      accountName,
      profileUrl,
      profileUid,
      password,
      passwordHint,
      emailOrPhone,
      twoFactorSecret,
      avatarUrl,
      status,
      accountCategory,
      targetRegion,
      notes,
      routineTargets,
    } = req.body;

    if (!accountName || !profileUrl) {
      return res.status(400).json({ success: false, message: 'Account name and Profile URL are required.' });
    }

    const isAdmin = req.user.role === 'admin';
    const settings = await SystemSetting.getSettings();

    const account = await FacebookAccount.create({
      smmId: req.user._id,
      accountName,
      profileUrl,
      profileUid: profileUid || '',
      password: password || passwordHint || '',
      passwordHint: passwordHint || password || '',
      emailOrPhone: emailOrPhone || '',
      twoFactorSecret: twoFactorSecret || '',
      avatarUrl: avatarUrl || '',
      status: status || 'warmup',
      approvalStatus: isAdmin ? 'approved' : 'pending',
      approvedBy: isAdmin ? req.user._id : null,
      approvedAt: isAdmin ? new Date() : null,
      pointsAwarded: 0,
      accountCategory: accountCategory || 'Personal / Engagement',
      targetRegion: targetRegion || 'Global',
      notes: notes || '',
      routineTargets: routineTargets || {
        feedComments: 5,
        communityReplies: 3,
        storyPost: true,
        groupShare: 2,
        feedScrollMinutes: 10,
      },
    });

    if (!isAdmin) {
      sendNotificationToRole('admin', {
        type: 'new_account',
        title: 'New Facebook Profile Submitted',
        message: `${req.user.name} submitted "${accountName}" for verification.`,
        link: '/verifications',
      });
    }

    return res.status(201).json({
      success: true,
      message: isAdmin
        ? 'Facebook account added successfully.'
        : `Facebook account submitted for verification! You will receive +${settings.facebookAccountReward || 40} PTS upon admin approval.`,
      account,
    });
  } catch (error) {
    console.error('Create FB Account error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all Facebook accounts for current logged-in SMM
exports.getMyAccounts = async (req, res) => {
  try {
    const accounts = await FacebookAccount.find({ smmId: req.user._id, isActive: true })
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: accounts.length, accounts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all Facebook accounts across the system (Admin only)
exports.getAllAccounts = async (req, res) => {
  try {
    const { approvalStatus, status, smmId } = req.query;
    let query = { isActive: true };

    if (approvalStatus && approvalStatus !== 'all') {
      query.approvalStatus = approvalStatus;
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (smmId) {
      query.smmId = smmId;
    }

    const accounts = await FacebookAccount.find(query)
      .populate('smmId', 'name email avatar rewardPoints')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: accounts.length, accounts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single account details
exports.getAccountById = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id)
      .populate('smmId', 'name email avatar')
      .populate('approvedBy', 'name email');

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Ensure SMM owns it or user is Admin
    if (req.user.role !== 'admin' && account.smmId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({ success: true, account });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update Facebook Account
exports.updateAccount = async (req, res) => {
  try {
    let account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (req.user.role !== 'admin' && account.smmId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const updates = req.body;
    account = await FacebookAccount.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    return res.json({
      success: true,
      message: 'Account updated successfully.',
      account,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Verify / Approve / Reject Facebook Account
exports.verifyAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNote, customPoints } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be either 'approve' or 'reject'." });
    }

    const account = await FacebookAccount.findById(id).populate('smmId');
    if (!account) {
      return res.status(404).json({ success: false, message: 'Facebook account not found.' });
    }

    const smmUser = await User.findById(account.smmId._id);
    if (!smmUser) {
      return res.status(404).json({ success: false, message: 'SMM owner of this account not found.' });
    }

    const settings = await SystemSetting.getSettings();

    if (action === 'approve') {
      const basePoints = customPoints !== undefined && customPoints !== null
        ? Number(customPoints)
        : (settings.facebookAccountReward || 40);

      let milestoneAwarded = false;
      let milestoneBonusAmount = 0;
      let totalApprovedCount = 0;

      // Only award points if it was not already approved
      if (account.approvalStatus !== 'approved') {
        smmUser.rewardPoints += basePoints;

        await PointTransaction.create({
          userId: smmUser._id,
          amount: basePoints,
          type: 'account_reward',
          description: `Reward for approved Facebook account: "${account.accountName}"`,
          referenceId: account._id,
          balanceAfter: smmUser.rewardPoints,
        });

        // Calculate milestone check (e.g. every 5 approved accounts by this SMM)
        // Count already approved accounts + this newly approved account
        const alreadyApproved = await FacebookAccount.countDocuments({
          smmId: smmUser._id,
          approvalStatus: 'approved',
          isActive: true,
          _id: { $ne: account._id },
        });

        totalApprovedCount = alreadyApproved + 1;
        const step = settings.facebookMilestoneStep || 5;

        if (totalApprovedCount > 0 && totalApprovedCount % step === 0) {
          milestoneBonusAmount = settings.facebookMilestoneReward || 100;
          smmUser.rewardPoints += milestoneBonusAmount;

          await PointTransaction.create({
            userId: smmUser._id,
            amount: milestoneBonusAmount,
            type: 'milestone_bonus',
            description: `🎉 Milestone Bonus: ${totalApprovedCount} Facebook Accounts Approved! (+${milestoneBonusAmount} PTS)`,
            referenceId: account._id,
            balanceAfter: smmUser.rewardPoints,
          });

          milestoneAwarded = true;
        }

        await smmUser.save();
      }

      account.approvalStatus = 'approved';
      account.approvedBy = req.user._id;
      account.approvedAt = new Date();
      account.adminNote = adminNote || 'Approved by Admin';
      account.pointsAwarded = basePoints;
      account.status = account.status === 'banned' ? 'banned' : 'active';
      await account.save();

      // Emit real-time notification to SMM
      sendNotificationToUser(smmUser._id, {
        type: 'account_approved',
        title: '🎉 Facebook Profile Approved!',
        message: `Your Facebook profile "${account.accountName}" was approved. +${basePoints} PTS credited!`,
        link: '/accounts',
        points: basePoints,
      });

      if (milestoneAwarded) {
        sendNotificationToUser(smmUser._id, {
          type: 'milestone_unlocked',
          title: '🎁 5-Account Milestone Bonus!',
          message: `Incredible! You reached ${totalApprovedCount} approved accounts. +${milestoneBonusAmount} PTS Bonus credited!`,
          link: '/accounts',
          points: milestoneBonusAmount,
        });
      }

      return res.json({
        success: true,
        message: milestoneAwarded
          ? `Account approved! Awarded ${basePoints} PTS + 🎁 ${milestoneBonusAmount} PTS Milestone Bonus (${totalApprovedCount}th account)!`
          : `Account approved! ${basePoints} PTS awarded to ${smmUser.name}.`,
        account,
        pointsAwarded: basePoints,
        milestoneAwarded,
        milestoneBonusAmount,
        totalApprovedCount,
      });
    } else {
      // Reject
      if (!adminNote || adminNote.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Please provide a rejection note explaining what needs to be fixed.',
        });
      }

      account.approvalStatus = 'rejected';
      account.adminNote = adminNote.trim();
      account.approvedBy = req.user._id;
      account.approvedAt = new Date();
      await account.save();

      sendNotificationToUser(smmUser._id, {
        type: 'account_rejected',
        title: '⚠️ Facebook Profile Declined',
        message: `"${account.accountName}" was declined by admin. Reason: ${adminNote.trim()}`,
        link: '/accounts',
      });

      return res.json({
        success: true,
        message: 'Facebook account rejected with feedback note.',
        account,
      });
    }
  } catch (error) {
    console.error('Verify account error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// SMM Get Milestone Progress for Facebook Account Creation
exports.getMilestoneProgress = async (req, res) => {
  try {
    const smmId = req.user._id;
    const settings = await SystemSetting.getSettings();

    const [approvedAccounts, pendingAccounts] = await Promise.all([
      FacebookAccount.countDocuments({ smmId, approvalStatus: 'approved', isActive: true }),
      FacebookAccount.countDocuments({ smmId, approvalStatus: 'pending', isActive: true }),
    ]);

    const milestoneStep = settings.facebookMilestoneStep || 5;
    const milestoneReward = settings.facebookMilestoneReward || 100;
    const accountCreationReward = settings.facebookAccountReward || 40;

    const currentProgressInStep = approvedAccounts % milestoneStep;
    const percentage = Math.round((currentProgressInStep / milestoneStep) * 100);
    const accountsNeededForNext = milestoneStep - currentProgressInStep;
    const totalMilestonesUnlocked = Math.floor(approvedAccounts / milestoneStep);

    return res.json({
      success: true,
      milestoneProgress: {
        approvedAccounts,
        pendingAccounts,
        milestoneStep,
        currentProgressInStep,
        percentage,
        accountsNeededForNext,
        nextRewardPoints: milestoneReward,
        accountCreationReward,
        totalMilestonesUnlocked,
        totalBonusPointsEarned: totalMilestonesUnlocked * milestoneReward,
      },
    });
  } catch (error) {
    console.error('Get milestone progress error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete / Archive Facebook Account
exports.deleteAccount = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (req.user.role !== 'admin' && account.smmId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    account.isActive = false;
    await account.save();

    return res.json({ success: true, message: 'Facebook account removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
