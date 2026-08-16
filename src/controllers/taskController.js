const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

// Create a new task (Admin only)
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      taskType,
      category,
      rewardPoints,
      targetUrl,
      instructions,
      assignedTo,
      isBroadcast,
      screenshotRequired,
      profileLinkRequired,
      deadline,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    const task = await Task.create({
      title,
      description,
      taskType: taskType || 'custom',
      category: category || 'Facebook Engagement',
      rewardPoints: Number(rewardPoints) || 50,
      targetUrl: targetUrl || '',
      instructions: instructions || '',
      assignedTo: isBroadcast ? null : (assignedTo || null),
      isBroadcast: isBroadcast !== undefined ? isBroadcast : true,
      screenshotRequired: screenshotRequired !== undefined ? screenshotRequired : true,
      profileLinkRequired: profileLinkRequired !== undefined ? profileLinkRequired : true,
      deadline: deadline ? new Date(deadline) : null,
      createdBy: req.user._id,
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      task,
    });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all tasks (Available for SMM, All for Admin)
exports.getTasks = async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = {};

    if (status) query.status = status;
    else if (req.user.role !== 'admin') query.status = 'active';

    if (type) query.taskType = type;

    // If SMM, show broadcast tasks OR tasks explicitly assigned to them
    if (req.user.role !== 'admin') {
      query.$or = [
        { isBroadcast: true },
        { assignedTo: req.user._id },
      ];
    }

    const tasks = await Task.find(query)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    // If SMM, attach submission status for each task
    let enhancedTasks = tasks;
    if (req.user.role !== 'admin') {
      const submissions = await TaskSubmission.find({ smmId: req.user._id });
      const submissionMap = {};
      submissions.forEach(sub => {
        submissionMap[sub.taskId.toString()] = sub;
      });

      enhancedTasks = tasks.map(t => {
        const doc = t.toObject();
        doc.mySubmission = submissionMap[t._id.toString()] || null;
        return doc;
      });
    }

    return res.json({ success: true, count: enhancedTasks.length, tasks: enhancedTasks });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single task details
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    let mySubmission = null;
    if (req.user.role !== 'admin') {
      mySubmission = await TaskSubmission.findOne({ taskId: task._id, smmId: req.user._id })
        .populate('facebookAccountId', 'accountName profileUrl avatarUrl');
    }

    return res.json({ success: true, task, mySubmission });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update task (Admin only)
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    return res.json({ success: true, message: 'Task updated successfully.', task });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete task (Admin only)
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    await TaskSubmission.deleteMany({ taskId: req.params.id });
    return res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// SMM Submit Proof for Task
exports.submitTaskProof = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { facebookAccountId, profileUrl, proofUrl, screenshotUrl, smmNotes } = req.body;

    // Enforce 5 Facebook accounts requirement for SMM users
    if (req.user.role !== 'admin') {
      const activeAccountsCount = await FacebookAccount.countDocuments({
        smmId: req.user._id,
        isActive: true,
      });

      if (activeAccountsCount < 5) {
        return res.status(403).json({
          success: false,
          message: `You must create at least 5 Facebook accounts before participating in tasks. (Currently: ${activeAccountsCount}/5)`,
        });
      }
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.profileLinkRequired && !profileUrl && !proofUrl) {
      return res.status(400).json({ success: false, message: 'Please provide the completed profile or proof URL.' });
    }

    if (task.screenshotRequired && !screenshotUrl) {
      return res.status(400).json({ success: false, message: 'A screenshot proof is required for this task.' });
    }

    // Check if existing submission exists for this task & smm
    let submission = await TaskSubmission.findOne({ taskId, smmId: req.user._id });

    if (submission && submission.status === 'approved') {
      return res.status(400).json({ success: false, message: 'This task has already been approved and rewarded.' });
    }

    if (submission) {
      // Re-submit
      submission.facebookAccountId = facebookAccountId || submission.facebookAccountId;
      submission.profileUrl = profileUrl || submission.profileUrl;
      submission.proofUrl = proofUrl || submission.proofUrl;
      submission.screenshotUrl = screenshotUrl || submission.screenshotUrl;
      submission.smmNotes = smmNotes !== undefined ? smmNotes : submission.smmNotes;
      submission.status = 'pending';
      submission.adminNote = ''; // reset cancellation note on resubmit
      await submission.save();
    } else {
      submission = await TaskSubmission.create({
        taskId,
        smmId: req.user._id,
        facebookAccountId: facebookAccountId || null,
        profileUrl: profileUrl || '',
        proofUrl: proofUrl || '',
        screenshotUrl: screenshotUrl || '',
        smmNotes: smmNotes || '',
        status: 'pending',
      });
    }

    const populatedSubmission = await TaskSubmission.findById(submission._id)
      .populate('taskId', 'title rewardPoints taskType')
      .populate('facebookAccountId', 'accountName profileUrl');

    return res.status(201).json({
      success: true,
      message: 'Proof submitted successfully! Awaiting admin verification.',
      submission: populatedSubmission,
    });
  } catch (error) {
    console.error('Submit task proof error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin get all submissions (Verification Portal)
exports.getAllSubmissions = async (req, res) => {
  try {
    const { status, smmId, taskId } = req.query;
    let query = {};

    if (status && status !== 'all') query.status = status;
    if (smmId) query.smmId = smmId;
    if (taskId) query.taskId = taskId;

    const submissions = await TaskSubmission.find(query)
      .populate('taskId', 'title rewardPoints taskType category targetUrl instructions')
      .populate('smmId', 'name email avatar rewardPoints')
      .populate('facebookAccountId', 'accountName profileUrl avatarUrl status')
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: submissions.length, submissions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// SMM get their own submissions
exports.getMySubmissions = async (req, res) => {
  try {
    const submissions = await TaskSubmission.find({ smmId: req.user._id })
      .populate('taskId', 'title rewardPoints taskType category targetUrl instructions')
      .populate('facebookAccountId', 'accountName profileUrl avatarUrl')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: submissions.length, submissions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Verify Submission (Approve / Reject with Notes & Reward Points)
exports.verifySubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNote, bonusPoints } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be either 'approve' or 'reject'." });
    }

    const submission = await TaskSubmission.findById(id)
      .populate('taskId')
      .populate('smmId');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    const smmUser = await User.findById(submission.smmId._id);
    if (!smmUser) {
      return res.status(404).json({ success: false, message: 'SMM User not found.' });
    }

    if (action === 'approve') {
      const basePoints = submission.taskId ? submission.taskId.rewardPoints : 50;
      const extra = Number(bonusPoints) || 0;
      const totalPoints = basePoints + extra;

      // Only award points if it was not already approved
      if (submission.status !== 'approved') {
        smmUser.rewardPoints += totalPoints;
        await smmUser.save();

        await PointTransaction.create({
          userId: smmUser._id,
          amount: totalPoints,
          type: 'task_reward',
          description: `Reward for task: "${submission.taskId ? submission.taskId.title : 'Task'}"${extra > 0 ? ` (+${extra} bonus)` : ''}`,
          referenceId: submission._id,
          balanceAfter: smmUser.rewardPoints,
        });
      }

      submission.status = 'approved';
      submission.adminNote = adminNote || 'Approved by Admin';
      submission.pointsAwarded = totalPoints;
      submission.verifiedBy = req.user._id;
      submission.verifiedAt = new Date();
      await submission.save();

      return res.json({
        success: true,
        message: `Task approved! ${totalPoints} points awarded to ${smmUser.name}.`,
        submission,
      });
    } else {
      // Reject / Cancel
      if (!adminNote || adminNote.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Please provide a cancellation note/reason so the SMM knows how to fix it.',
        });
      }

      submission.status = 'rejected';
      submission.adminNote = adminNote.trim();
      submission.verifiedBy = req.user._id;
      submission.verifiedAt = new Date();
      await submission.save();

      return res.json({
        success: true,
        message: 'Task submission rejected with feedback note.',
        submission,
      });
    }
  } catch (error) {
    console.error('Verify submission error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
