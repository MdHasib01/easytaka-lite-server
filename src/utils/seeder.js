const User = require('../models/User');
const FacebookAccount = require('../models/FacebookAccount');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const PointTransaction = require('../models/PointTransaction');
const SystemSetting = require('../models/SystemSetting');
const DailyTaskTemplate = require('../models/DailyTaskTemplate');

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

    // 5. Ensure FB accounts exist for David
    const davidAccountCount = await FacebookAccount.countDocuments({ smmId: smm2._id });
    if (davidAccountCount === 0) {
      await FacebookAccount.create({
        smmId: smm2._id,
        accountName: 'David Media Pro',
        profileUrl: 'https://facebook.com/david.media.pro.99',
        profileUid: '1000991188331',
        emailOrPhone: 'david.media99@gmail.com',
        status: 'active',
        approvalStatus: 'approved',
        pointsAwarded: 40,
        approvedAt: new Date(),
        accountCategory: 'Affiliate Marketing',
        targetRegion: 'UK & Europe',
        friendsCount: 890,
        groupsCount: 14,
        routineTargets: {
          feedComments: 5,
          communityReplies: 3,
          storyPost: true,
          groupShare: 2,
          feedScrollMinutes: 10,
        },
      });
    }

    // 6. Ensure Global Rotated Daily Tasks and Quota Campaigns exist
    const templateCount = await DailyTaskTemplate.countDocuments();
    if (templateCount === 0) {
      // Global Tasks Batch 1 (Runs on Alternate Days A)
      await DailyTaskTemplate.create({
        title: 'Personal Profile: Post Tech / AI Industry News',
        taskType: 'personal_profile_post',
        description: 'Post an engaging update on your personal profile timeline sharing an interesting thought or article about modern AI / Tech productivity tools.',
        sampleCaption: 'AI tools are evolving so fast! What is your favorite productivity stack right now? 🚀 #TechTrends #Productivity',
        mode: 'global_rotation',
        rotationSchedule: 'alternate_days',
        rotationBatch: 1,
        status: 'active',
        createdBy: admin._id,
      });

      await DailyTaskTemplate.create({
        title: 'Group React: Like & Love Top 3 Posts in Targeted Groups',
        taskType: 'react_group_post',
        description: 'Visit your active Facebook groups and react with Love/Care to at least 3 high-engagement community posts to maintain natural account activity.',
        mode: 'global_rotation',
        rotationSchedule: 'alternate_days',
        rotationBatch: 1,
        status: 'active',
        createdBy: admin._id,
      });

      await DailyTaskTemplate.create({
        title: 'Story Post: Share Behind the Scenes / Quote Story',
        taskType: 'story_post',
        description: 'Upload a motivational quote or quick lifestyle photo to your Facebook Story to boost algorithmic reach and profile views.',
        mode: 'global_rotation',
        rotationSchedule: 'alternate_days',
        rotationBatch: 1,
        status: 'active',
        createdBy: admin._id,
      });

      // Global Tasks Batch 2 (Runs on Alternate Days B)
      await DailyTaskTemplate.create({
        title: 'Personal Profile: Share Lifestyle / Work Question Post',
        taskType: 'personal_profile_post',
        description: 'Publish a friendly question on your personal timeline asking your friends for recommendations or advice to drive comment interactions.',
        sampleCaption: 'Coffee or Tea while working? ☕ Drop your favorite morning fuel below! 👇',
        mode: 'global_rotation',
        rotationSchedule: 'alternate_days',
        rotationBatch: 2,
        status: 'active',
        createdBy: admin._id,
      });

      await DailyTaskTemplate.create({
        title: 'Group React: React to Recent Questions in Niche Groups',
        taskType: 'react_group_post',
        description: 'Browse targeted marketing/business groups and react with insightful emojis to member questions and discussions.',
        mode: 'global_rotation',
        rotationSchedule: 'alternate_days',
        rotationBatch: 2,
        status: 'active',
        createdBy: admin._id,
      });

      await DailyTaskTemplate.create({
        title: 'Feed Warmup: Natural Feed Scrolling & Video Viewing',
        taskType: 'feed_scroll_warmup',
        description: 'Spend 5-10 minutes watching a trending reel/video in your feed and liking 2 organic creator posts to simulate authentic human behavior.',
        mode: 'global_rotation',
        rotationSchedule: 'alternate_days',
        rotationBatch: 2,
        status: 'active',
        createdBy: admin._id,
      });

      // Targeted Quota Campaign (e.g. 10 comments needed on specific group post, load-balanced across accounts)
      const allApproved = await FacebookAccount.find({ isActive: true, approvalStatus: { $in: ['approved', null] } });
      const quotaTemplate = await DailyTaskTemplate.create({
        title: 'Targeted Campaign: Post 10 Insightful Comments on Growth Hackers Post',
        taskType: 'comment_group_post',
        description: 'Leave positive, helpful comments discussing growth automation on the featured Facebook post.',
        targetUrl: 'https://facebook.com/groups/growthhackers/posts/991823712',
        instructions: 'Read the post topic. Leave a 2-sentence supportive comment. Avoid spam words.',
        sampleCaption: 'Great insights! Automation has completely transformed how we manage multi-channel workflows.',
        mode: 'targeted_quota',
        targetExecutionsCount: Math.min(10, allApproved.length || 10),
        status: 'active',
        createdBy: admin._id,
      });

      // Assign quota using round-robin distribution
      const taskDistributionService = require('../services/taskDistributionService');
      await taskDistributionService.distributeQuotaTask(quotaTemplate._id, quotaTemplate.targetExecutionsCount);

      console.log('[Seeder] Created 6 Global Rotated Daily Tasks and 1 Load-Balanced Quota Campaign.');
    }

    // 7. Ensure Broadcast Tasks Hub has initial tasks including Create Facebook Account task
    const taskCount = await Task.countDocuments();
    if (taskCount === 0) {
      await Task.create({
        title: 'Create Verified Facebook Profile with 2FA',
        description: 'Create a realistic Facebook profile with genuine avatar, cover photo, bio details and 2-Factor Authentication enabled. Submit profile URL and screenshot proof to claim reward points.',
        taskType: 'create_account',
        category: 'Account Creation',
        rewardPoints: 100,
        instructions: '1. Register with a fresh email or phone.\n2. Set up realistic name, profile picture and bio.\n3. Turn on 2FA security.\n4. Submit profile URL and screenshot.',
        isBroadcast: true,
        screenshotRequired: true,
        profileLinkRequired: true,
        createdBy: admin._id,
        status: 'active',
      });

      await Task.create({
        title: 'Comment on Featured Tech & AI Growth Post',
        description: 'Leave 2-3 constructive and engaging comments on the designated Facebook discussion post to drive viral discussions.',
        taskType: 'comment_post',
        category: 'Viral Commenting',
        rewardPoints: 40,
        targetUrl: 'https://facebook.com/groups/growthhackers/posts/991823712',
        instructions: 'Read the post topic, write a positive comment sharing thoughts on AI automation, and capture screenshot proof.',
        isBroadcast: true,
        screenshotRequired: true,
        profileLinkRequired: true,
        createdBy: admin._id,
        status: 'active',
      });

      await Task.create({
        title: 'Share Daily Motivational Story / Reel',
        description: 'Publish an inspiring story or reel to your Facebook profile story to maintain account visibility and active status.',
        taskType: 'story_post',
        category: 'Story Marketing',
        rewardPoints: 60,
        instructions: 'Upload an engaging story with motivational quote/image and take screenshot of your story view.',
        isBroadcast: true,
        screenshotRequired: true,
        profileLinkRequired: false,
        createdBy: admin._id,
        status: 'active',
      });

      console.log('[Seeder] Created 3 Broadcast Tasks including Create Facebook Account task.');
    }

    console.log('[Seeder] Seeding check completed.');
  } catch (error) {
    console.error('[Seeder] Error during seed:', error);
  }
};

module.exports = seedInitialData;
