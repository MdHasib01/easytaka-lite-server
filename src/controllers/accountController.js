const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const SystemSetting = require('../models/SystemSetting');
const { sendNotificationToUser, sendNotificationToRole } = require('../socket');

const populateAccountQuery = (query) => {
  return query
    .populate('smmId', 'name email avatar rewardPoints phone role')
    .populate('createdBy', 'name email avatar role')
    .populate('assignedTo', 'name email avatar role')
    .populate('assignedBy', 'name email')
    .populate('approvedBy', 'name email');
};

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
      emailPassword,
      twoFactorSecret,
      avatarUrl,
      status,
      accountCategory,
      targetRegion,
      notes,
      routineTargets,
      assignedTo,
      // SMM Mode & Persona fields
      accountMode,
      assignedProduct,
      workloadTier,
      childAge,
      purchaseDate,
      purchaseHistory,
      writingStyle,
      personaBio,
      customGuideline,
    } = req.body;

    if (!accountName || !profileUrl) {
      return res.status(400).json({ success: false, message: 'Account name and Profile URL are required.' });
    }

    const isAdmin = req.user.role === 'admin';
    const settings = await SystemSetting.getSettings();

    // Determine assignee (defaults to assignedTo if provided, otherwise the user creating it)
    const targetAssigneeId = assignedTo || req.user._id;

    // SMM Account Mode and Workload settings are strictly controlled by Admin
    const finalAccountMode = isAdmin ? (accountMode || 'general') : 'general';
    const finalAssignedProduct = isAdmin ? (assignedProduct || 'none') : 'none';
    const finalWorkloadTier = isAdmin ? (workloadTier || 'active') : 'active';
    const finalCustomGuideline = isAdmin ? (customGuideline || '') : '';

    const account = await FacebookAccount.create({
      smmId: targetAssigneeId,
      createdBy: req.user._id,
      assignedTo: targetAssigneeId,
      assignedAt: assignedTo ? new Date() : null,
      assignedBy: assignedTo && assignedTo.toString() !== req.user._id.toString() ? req.user._id : null,
      accountName,
      profileUrl,
      profileUid: profileUid || '',
      password: password || passwordHint || '',
      passwordHint: passwordHint || password || '',
      emailOrPhone: emailOrPhone || '',
      emailPassword: emailPassword || '',
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
      accountMode: finalAccountMode,
      assignedProduct: finalAssignedProduct,
      workloadTier: finalWorkloadTier,
      childAge: childAge || '',
      purchaseDate: purchaseDate || '',
      purchaseHistory: purchaseHistory || '',
      writingStyle: writingStyle || 'Bangla (বাঙালি মা টোন)',
      personaBio: personaBio || '',
      customGuideline: finalCustomGuideline,
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
    } else if (assignedTo && assignedTo.toString() !== req.user._id.toString()) {
      // Admin created and assigned to another SMM
      sendNotificationToUser(assignedTo, {
        type: 'new_account',
        title: '👤 Facebook Account Assigned',
        message: `${req.user.name} created and assigned Facebook profile "${accountName}" to you.`,
        link: '/accounts',
      });
    }

    const populatedAccount = await populateAccountQuery(FacebookAccount.findById(account._id));

    return res.status(201).json({
      success: true,
      message: isAdmin
        ? 'Facebook account added successfully.'
        : `Facebook account submitted for verification! You will receive +${settings.facebookAccountReward || 40} PTS upon admin approval.`,
      account: populatedAccount || account,
    });
  } catch (error) {
    console.error('Create FB Account error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all Facebook accounts for current logged-in SMM
exports.getMyAccounts = async (req, res) => {
  try {
    const accounts = await populateAccountQuery(
      FacebookAccount.find({
        $or: [{ smmId: req.user._id }, { assignedTo: req.user._id }, { createdBy: req.user._id }],
        isActive: true,
      }).sort({ createdAt: -1 })
    );

    return res.json({ success: true, count: accounts.length, accounts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all Facebook accounts across the system (Admin only)
exports.getAllAccounts = async (req, res) => {
  try {
    const { approvalStatus, status, smmId, assignedTo, createdBy } = req.query;
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
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }
    if (createdBy) {
      query.createdBy = createdBy;
    }

    const accounts = await populateAccountQuery(
      FacebookAccount.find(query).sort({ createdAt: -1 })
    );

    return res.json({ success: true, count: accounts.length, accounts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single account details
exports.getAccountById = async (req, res) => {
  try {
    const account = await populateAccountQuery(FacebookAccount.findById(req.params.id));

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const isSmm =
      (account.smmId && account.smmId._id?.toString() === req.user._id.toString()) ||
      (account.assignedTo && account.assignedTo._id?.toString() === req.user._id.toString()) ||
      (account.createdBy && account.createdBy._id?.toString() === req.user._id.toString());

    // Ensure SMM owns/assigned or user is Admin
    if (req.user.role !== 'admin' && !isSmm) {
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

    const isOwner = account.smmId && account.smmId.toString() === req.user._id.toString();
    const isCreator = account.createdBy && account.createdBy.toString() === req.user._id.toString();
    const isAssignee = account.assignedTo && account.assignedTo.toString() === req.user._id.toString();

    if (req.user.role !== 'admin' && !isOwner && !isCreator && !isAssignee) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const updates = { ...req.body };

    // SMM users CANNOT change mode, product line, workload tier, or approval attributes
    if (req.user.role !== 'admin') {
      delete updates.accountMode;
      delete updates.assignedProduct;
      delete updates.workloadTier;
      delete updates.customGuideline;
      delete updates.approvalStatus;
      delete updates.approvedBy;
      delete updates.approvedAt;
      delete updates.pointsAwarded;
    }

    // If assignedTo is explicitly modified
    if (updates.assignedTo && updates.assignedTo !== (account.assignedTo?.toString() || account.smmId?.toString())) {
      updates.smmId = updates.assignedTo;
      updates.assignedAt = new Date();
      updates.assignedBy = req.user._id;

      if (!account.createdBy) {
        updates.createdBy = account.smmId || req.user._id;
      }
    }

    account = await populateAccountQuery(
      FacebookAccount.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    );

    return res.json({
      success: true,
      message: 'Account updated successfully.',
      account,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Assign / Reassign Facebook Account to an SMM
exports.assignAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'Please select an SMM agent to assign.' });
    }

    const account = await FacebookAccount.findById(id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Facebook account not found.' });
    }

    const isCreator = account.createdBy && account.createdBy.toString() === req.user._id.toString();
    const isOwner = account.smmId && account.smmId.toString() === req.user._id.toString();
    if (req.user.role !== 'admin' && !isCreator && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins or Account Owner can reassign this account.',
      });
    }

    const targetUser = await User.findById(assignedTo);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target SMM user not found.' });
    }

    // Preserve original creator if not already recorded
    if (!account.createdBy) {
      account.createdBy = account.smmId || req.user._id;
    }

    account.assignedTo = targetUser._id;
    account.smmId = targetUser._id;
    account.assignedAt = new Date();
    account.assignedBy = req.user._id;
    await account.save();

    // Send real-time notification to assigned user
    if (targetUser._id.toString() !== req.user._id.toString()) {
      sendNotificationToUser(targetUser._id, {
        type: 'new_account',
        title: '👤 Facebook Account Assigned',
        message: `You have been assigned to manage Facebook profile "${account.accountName}".`,
        link: '/accounts',
      });
    }

    const populatedAccount = await populateAccountQuery(FacebookAccount.findById(account._id));

    return res.json({
      success: true,
      message: `Facebook account "${account.accountName}" assigned to ${targetUser.name || targetUser.email}.`,
      account: populatedAccount,
    });
  } catch (error) {
    console.error('Assign Account error:', error);
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
      const {
        accountMode,
        assignedProduct,
        workloadTier,
        childAge,
        purchaseDate,
        purchaseHistory,
        writingStyle,
        personaBio,
        customGuideline,
      } = req.body;

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

      // Admin can configure mode, product, and persona on approval
      if (accountMode) account.accountMode = accountMode;
      if (assignedProduct) account.assignedProduct = assignedProduct;
      if (workloadTier) account.workloadTier = workloadTier;
      if (childAge !== undefined) account.childAge = childAge;
      if (purchaseDate !== undefined) account.purchaseDate = purchaseDate;
      if (purchaseHistory !== undefined) account.purchaseHistory = purchaseHistory;
      if (writingStyle !== undefined) account.writingStyle = writingStyle;
      if (personaBio !== undefined) account.personaBio = personaBio;
      if (customGuideline !== undefined) account.customGuideline = customGuideline;

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

      const populatedAccount = await populateAccountQuery(FacebookAccount.findById(account._id));

      return res.json({
        success: true,
        message: milestoneAwarded
          ? `Account approved! Awarded ${basePoints} PTS + 🎁 ${milestoneBonusAmount} PTS Milestone Bonus (${totalApprovedCount}th account)!`
          : `Account approved! ${basePoints} PTS awarded to ${smmUser.name}.`,
        account: populatedAccount || account,
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

      const populatedAccount = await populateAccountQuery(FacebookAccount.findById(account._id));

      return res.json({
        success: true,
        message: 'Facebook account rejected with feedback note.',
        account: populatedAccount || account,
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
