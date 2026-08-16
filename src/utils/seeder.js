const User = require('../models/User');
const FacebookAccount = require('../models/FacebookAccount');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const PointTransaction = require('../models/PointTransaction');
const SystemSetting = require('../models/SystemSetting');

const seedInitialData = async () => {
  try {
    // 0. Ensure System Settings exist
    await SystemSetting.getSettings();

    // 1. Ensure Admin exists and has known password
    let admin = await User.findOne({ email: 'admin@esytaka.com' });
    if (!admin) {
      admin = new User({
        name: 'Alex Admin',
        email: 'admin@esytaka.com',
        password: 'admin123',
        role: 'admin',
        status: 'active',
        phone: '+1 234 567 8900',
        rewardPoints: 500,
        dailyTaskCompletionReward: 50,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      });
      await admin.save();
      console.log('[Seeder] Created default Admin (admin@esytaka.com / admin123)');
    } else if (admin.status !== 'active') {
      admin.status = 'active';
      await admin.save();
    }

    // 2. Ensure Demo SMM exists and has known password
    let smm1 = await User.findOne({ email: 'smm@esytaka.com' });
    if (!smm1) {
      smm1 = new User({
        name: 'Sarah SMM',
        email: 'smm@esytaka.com',
        password: 'smm123',
        role: 'smm',
        status: 'active',
        phone: '+880 1712 345678',
        rewardPoints: 340,
        dailyTaskCompletionReward: 75,
        streakDays: 4,
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      });
      await smm1.save();
      console.log('[Seeder] Created default SMM (smm@esytaka.com / smm123)');
    } else if (smm1.status !== 'active') {
      smm1.status = 'active';
      await smm1.save();
    }

    // 3. Ensure SMM 2 exists
    let smm2 = await User.findOne({ email: 'david@esytaka.com' });
    if (!smm2) {
      smm2 = new User({
        name: 'David Marketer',
        email: 'david@esytaka.com',
        password: 'smm123',
        role: 'smm',
        status: 'active',
        phone: '+880 1819 888999',
        rewardPoints: 620,
        dailyTaskCompletionReward: 60,
        streakDays: 7,
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      });
      await smm2.save();
    } else if (smm2.status !== 'active') {
      smm2.status = 'active';
      await smm2.save();
    }

    // 3.5. Ensure a sample Pending Verification SMM exists for Admin to test review
    let smmPending = await User.findOne({ email: 'tanvir.media@gmail.com' });
    if (!smmPending) {
      smmPending = new User({
        name: 'Tanvir Hossain',
        email: 'tanvir.media@gmail.com',
        password: 'smmpassword123',
        role: 'smm',
        status: 'pending_verification',
        phone: '+880 1798 765432',
        address: 'House 42, Road 11, Banani, Dhaka-1213, Bangladesh',
        nidNumber: '5928193821092',
        nidFront: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
        nidBack: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        termsAgreed: true,
        termsAgreedAt: new Date(Date.now() - 3600000 * 4),
        verificationSubmittedAt: new Date(Date.now() - 3600000 * 4),
      });
      await smmPending.save();
      console.log('[Seeder] Created sample pending SMM applicant (tanvir.media@gmail.com)');
    }

    // 4. Ensure FB accounts exist for Sarah
    const accountCount = await FacebookAccount.countDocuments({ smmId: smm1._id });
    if (accountCount === 0) {
      await FacebookAccount.create({
        smmId: smm1._id,
        accountName: 'Sarah Jenkins (Tech Influencer)',
        profileUrl: 'https://facebook.com/sarah.jenkins.profile.98',
        profileUid: '1000889218271',
        emailOrPhone: 'sarah.j.fb98@gmail.com',
        status: 'active',
        approvalStatus: 'approved',
        pointsAwarded: 40,
        approvedAt: new Date(),
        accountCategory: 'Tech / SaaS Niche',
        targetRegion: 'USA & Canada',
        friendsCount: 1420,
        groupsCount: 18,
        notes: 'Main active profile. Verified with 2FA.',
        routineTargets: {
          feedComments: 5,
          communityReplies: 3,
          storyPost: true,
          groupShare: 2,
          feedScrollMinutes: 15,
        },
      });

      await FacebookAccount.create({
        smmId: smm1._id,
        accountName: 'Daily Trends BD Hub',
        profileUrl: 'https://facebook.com/dailytrends.bd.hub',
        profileUid: '1000994821124',
        emailOrPhone: 'dailytrends.bd@gmail.com',
        status: 'warmup',
        approvalStatus: 'approved',
        pointsAwarded: 40,
        approvedAt: new Date(),
        accountCategory: 'E-commerce & Local Marketing',
        targetRegion: 'Bangladesh & Asia',
        friendsCount: 450,
        groupsCount: 12,
        notes: 'Warm-up phase day 6. Do not post more than 5 comments daily.',
        routineTargets: {
          feedComments: 4,
          communityReplies: 2,
          storyPost: true,
          groupShare: 1,
          feedScrollMinutes: 10,
        },
      });

      // Also create 1 pending account for Sarah to demonstrate the approval queue
      await FacebookAccount.create({
        smmId: smm1._id,
        accountName: 'Global Crypto & Web3 Explorer',
        profileUrl: 'https://facebook.com/crypto.web3.explorer.sarah',
        profileUid: '1000999812455',
        emailOrPhone: 'crypto.sarah99@gmail.com',
        status: 'warmup',
        approvalStatus: 'pending',
        pointsAwarded: 0,
        accountCategory: 'Crypto & Finance',
        targetRegion: 'Global / Tier 1',
        friendsCount: 120,
        groupsCount: 8,
        notes: 'Newly registered account with proxy. Ready for approval.',
        routineTargets: {
          feedComments: 5,
          communityReplies: 3,
          storyPost: true,
          groupShare: 2,
          feedScrollMinutes: 10,
        },
      });
    }

    // 5. Ensure Tasks exist
    const taskCount = await Task.countDocuments();
    if (taskCount === 0) {
      const task1 = await Task.create({
        title: 'Create Verified Facebook Account (US Identity)',
        description: 'Create a new Facebook account with a realistic US name, profile photo, bio, and add 5 relevant group joins. Submit profile link and screenshot of completed profile page.',
        taskType: 'create_account',
        category: 'Account Creation',
        rewardPoints: 100,
        targetUrl: 'https://facebook.com',
        instructions: '1. Use clean browser profile.\n2. Set 2FA with Authenticator.\n3. Add bio and avatar.\n4. Submit profile URL and screenshot.',
        createdBy: admin._id,
        screenshotRequired: true,
        profileLinkRequired: true,
        isBroadcast: true,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const task2 = await Task.create({
        title: 'Post 3 Thoughtful Comments on AI SaaS Discussion Post',
        description: 'Go to the target Facebook post discussing marketing automation and post an insightful comment recommending our solutions.',
        taskType: 'comment_post',
        category: 'Viral Commenting',
        rewardPoints: 40,
        targetUrl: 'https://facebook.com/groups/digitalgrowthhackers/posts/99823123',
        instructions: 'Comment should be at least 2 sentences. Take screenshot of your comment with timestamp.',
        createdBy: admin._id,
        screenshotRequired: true,
        profileLinkRequired: true,
        isBroadcast: true,
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });

      const task3 = await Task.create({
        title: 'Reply to Community Questions on Digital Marketers Group',
        description: 'Answer questions in the Digital Marketers Group feed helping users with affiliate and media marketing strategies.',
        taskType: 'community_reply',
        category: 'Community Engagement',
        rewardPoints: 60,
        targetUrl: 'https://facebook.com/groups/digitalmarketingmasters',
        instructions: 'Leave helpful replies. Add link to your profile and screenshot.',
        createdBy: admin._id,
        screenshotRequired: true,
        profileLinkRequired: true,
        isBroadcast: true,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      });

      // Sample submission for admin review
      const acc1 = await FacebookAccount.findOne({ smmId: smm1._id });
      await TaskSubmission.create({
        taskId: task1._id,
        smmId: smm1._id,
        facebookAccountId: acc1 ? acc1._id : null,
        profileUrl: 'https://facebook.com/sarah.jenkins.profile.98',
        proofUrl: 'https://facebook.com/sarah.jenkins.profile.98',
        screenshotUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80',
        smmNotes: 'Created account with US proxy, 2FA enabled, profile pic and cover uploaded.',
        status: 'pending',
      });
    }

    console.log('[Seeder] Seeding check completed.');
  } catch (error) {
    console.error('[Seeder] Error during seed:', error);
  }
};

module.exports = seedInitialData;
