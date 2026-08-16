const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  sendSmmInvitationEmail,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
} = require('../config/mailer');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET || 'esy_taka_super_secret_jwt_key_2026_x99!',
    { expiresIn: '30d' }
  );
};

// Admin invites SMM by Email
exports.inviteSMM = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a valid SMM email address.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    let user = await User.findOne({ email: cleanEmail });

    if (user && user.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'This email is already an active registered user.',
      });
    }

    // Generate secure token (valid for 7 days)
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (user) {
      user.invitationToken = invitationToken;
      user.invitationExpires = invitationExpires;
      user.status = 'invited';
      user.role = 'smm';
      await user.save();
    } else {
      user = await User.create({
        email: cleanEmail,
        role: 'smm',
        status: 'invited',
        invitationToken,
        invitationExpires,
      });
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/setup-account?token=${invitationToken}`;

    // Send invitation email in background
    sendSmmInvitationEmail(cleanEmail, inviteUrl).catch((err) =>
      console.error('[Invitation Mail Error]', err)
    );

    return res.status(200).json({
      success: true,
      message: `Invitation successfully sent to ${cleanEmail}`,
      inviteUrl,
      user: {
        id: user._id,
        email: user.email,
        status: user.status,
        invitationExpires: user.invitationExpires,
      },
    });
  } catch (error) {
    console.error('Invite SMM error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Validate invitation token before onboarding
exports.verifyInvitationToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Invalid or missing invitation token.' });
    }

    const user = await User.findOne({
      invitationToken: token,
      invitationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invitation link is invalid, has expired, or has already been used.',
      });
    }

    return res.json({
      success: true,
      email: user.email,
      status: user.status,
    });
  } catch (error) {
    console.error('Verify invitation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// SMM completes multi-step onboarding (Profile + NID dual-side)
exports.completeSmmOnboarding = async (req, res) => {
  try {
    const {
      token,
      name,
      phone,
      password,
      avatar,
      nidFront,
      nidBack,
      nidNumber,
      address,
      termsAgreed,
    } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Missing invitation token.' });
    }

    const user = await User.findOne({
      invitationToken: token,
      invitationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invitation token. Please ask the administrator for a new invite.',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your full name.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    if (!nidFront || !nidBack) {
      return res.status(400).json({
        success: false,
        message: 'Both Front and Back photos of your National ID card are required.',
      });
    }

    if (!termsAgreed) {
      return res.status(400).json({
        success: false,
        message: 'You must agree to the Terms & Conditions and Workplace Policies.',
      });
    }

    user.name = name.trim();
    user.phone = phone ? phone.trim() : '';
    user.password = password; // Hashed by pre-save hook
    user.avatar = avatar || '';
    user.nidFront = nidFront;
    user.nidBack = nidBack;
    user.nidNumber = nidNumber ? nidNumber.trim() : '';
    user.address = address ? address.trim() : '';
    user.termsAgreed = true;
    user.termsAgreedAt = new Date();
    user.verificationSubmittedAt = new Date();
    user.status = 'pending_verification';
    user.invitationToken = ''; // Clear token once submitted
    user.invitationExpires = undefined;

    await user.save();

    // Notify Admins in real-time
    const { sendNotificationToRole } = require('../socket');
    sendNotificationToRole('admin', {
      type: 'new_smm_verification',
      title: '📝 New SMM Application Submitted',
      message: `${user.name} (${user.email}) submitted National ID documents for verification.`,
      link: '/verifications',
    });

    return res.json({
      success: true,
      message: 'Account details and National ID submitted successfully. Your account is now pending admin verification.',
      status: 'pending_verification',
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Login User (with Status Validation)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Status check for SMM / standard users
    if (user.role === 'smm') {
      if (user.status === 'invited') {
        return res.status(403).json({
          success: false,
          message: 'Account setup incomplete. Please check your email for the invitation link to set up your profile and National ID.',
        });
      }

      if (user.status === 'pending_verification') {
        return res.status(403).json({
          success: false,
          message: 'Your account is currently under review by an administrator. You will be able to log in once your National ID and profile are verified.',
        });
      }

      if (user.status === 'rejected') {
        return res.status(403).json({
          success: false,
          message: `Your account verification was rejected: ${user.rejectionReason || 'Documents did not meet verification criteria. Please contact administrator.'}`,
        });
      }

      if (user.status === 'suspended' || !user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated or suspended. Please contact administrator.',
        });
      }
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        rewardPoints: user.rewardPoints,
        dailyTaskCompletionReward: user.dailyTaskCompletionReward !== undefined ? user.dailyTaskCompletionReward : 50,
        avatar: user.avatar,
        phone: user.phone,
        streakDays: user.streakDays,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get current user profile
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        rewardPoints: user.rewardPoints,
        dailyTaskCompletionReward: user.dailyTaskCompletionReward !== undefined ? user.dailyTaskCompletionReward : 50,
        avatar: user.avatar,
        phone: user.phone,
        streakDays: user.streakDays,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (avatar) user.avatar = avatar;

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        rewardPoints: user.rewardPoints,
        avatar: user.avatar,
        phone: user.phone,
        streakDays: user.streakDays,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// List SMM verification applications (Admin only)
exports.listSmmVerifications = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = { role: 'smm' };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const smms = await User.find(filter)
      .select('-password')
      .populate('verifiedBy', 'name email')
      .sort({ verificationSubmittedAt: -1, createdAt: -1 });

    return res.json({
      success: true,
      count: smms.length,
      smms,
    });
  } catch (error) {
    console.error('List SMM verifications error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin verify / approve / reject SMM
exports.verifySmm = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    const smm = await User.findById(id);
    if (!smm) {
      return res.status(404).json({ success: false, message: 'SMM applicant not found.' });
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const loginUrl = `${clientUrl}/login`;

    if (action === 'approve') {
      smm.status = 'active';
      smm.verifiedBy = req.user._id;
      smm.verifiedAt = new Date();
      smm.rejectionReason = '';
      if (smm.rewardPoints === 0) {
        smm.rewardPoints = 100; // Welcome reward points
      }
      await smm.save();

      // Dispatch congratulation email
      sendAccountApprovedEmail(smm.email, smm.name, loginUrl).catch((err) =>
        console.error('[Approval Mail Error]', err)
      );

      return res.json({
        success: true,
        message: `SMM account for ${smm.name || smm.email} has been approved and activated.`,
        smm,
      });
    } else if (action === 'reject') {
      smm.status = 'rejected';
      smm.verifiedBy = req.user._id;
      smm.verifiedAt = new Date();
      smm.rejectionReason =
        rejectionReason || 'National ID or uploaded documents were unclear or invalid.';
      await smm.save();

      // Dispatch rejection notice email
      sendAccountRejectedEmail(smm.email, smm.name, smm.rejectionReason).catch((err) =>
        console.error('[Rejection Mail Error]', err)
      );

      return res.json({
        success: true,
        message: `SMM application for ${smm.name || smm.email} was rejected.`,
        smm,
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be approve or reject.' });
    }
  } catch (error) {
    console.error('Verify SMM error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Resend invitation email (Admin only)
exports.resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    const smm = await User.findById(id);
    if (!smm) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const invitationToken = crypto.randomBytes(32).toString('hex');
    smm.invitationToken = invitationToken;
    smm.invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    smm.status = 'invited';
    await smm.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/setup-account?token=${invitationToken}`;

    await sendSmmInvitationEmail(smm.email, inviteUrl);

    return res.json({
      success: true,
      message: `Invitation resent to ${smm.email}`,
      inviteUrl,
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// List all active SMM users (Admin only)
exports.listSMMs = async (req, res) => {
  try {
    const smms = await User.find({ role: 'smm', status: 'active', isActive: true })
      .select('-password')
      .sort({ rewardPoints: -1 });

    return res.json({ success: true, count: smms.length, smms });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin update specific SMM's daily task completion reward
exports.updateSmmDailyReward = async (req, res) => {
  try {
    const { id } = req.params;
    const { dailyTaskCompletionReward } = req.body;

    if (dailyTaskCompletionReward === undefined || isNaN(dailyTaskCompletionReward)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid daily task reward point amount.' });
    }

    const smm = await User.findById(id);
    if (!smm) {
      return res.status(404).json({ success: false, message: 'SMM User not found.' });
    }

    smm.dailyTaskCompletionReward = Math.max(0, Number(dailyTaskCompletionReward));
    await smm.save();

    return res.json({
      success: true,
      message: `Daily task completion reward updated to ${smm.dailyTaskCompletionReward} PTS for ${smm.name || smm.email}.`,
      smm: {
        id: smm._id,
        name: smm.name,
        email: smm.email,
        dailyTaskCompletionReward: smm.dailyTaskCompletionReward,
      },
    });
  } catch (error) {
    console.error('Update SMM daily reward error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

