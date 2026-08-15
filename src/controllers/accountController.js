const FacebookAccount = require('../models/FacebookAccount');

// Create a new Facebook account record (SMM or Admin)
exports.createAccount = async (req, res) => {
  try {
    const {
      accountName,
      profileUrl,
      profileUid,
      emailOrPhone,
      passwordHint,
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

    const account = await FacebookAccount.create({
      smmId: req.user._id,
      accountName,
      profileUrl,
      profileUid: profileUid || '',
      emailOrPhone: emailOrPhone || '',
      passwordHint: passwordHint || '',
      twoFactorSecret: twoFactorSecret || '',
      avatarUrl: avatarUrl || '',
      status: status || 'warmup',
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

    return res.status(201).json({
      success: true,
      message: 'Facebook account added successfully.',
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
    const accounts = await FacebookAccount.find({ isActive: true })
      .populate('smmId', 'name email avatar')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: accounts.length, accounts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single account details
exports.getAccountById = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id).populate('smmId', 'name email');
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
