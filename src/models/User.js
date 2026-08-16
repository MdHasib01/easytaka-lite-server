const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['admin', 'smm'],
      default: 'smm',
    },
    status: {
      type: String,
      enum: ['invited', 'pending_verification', 'active', 'rejected', 'suspended'],
      default: 'active',
    },
    invitationToken: {
      type: String,
      default: '',
    },
    invitationExpires: {
      type: Date,
    },
    avatar: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    nidFront: {
      type: String,
      default: '',
    },
    nidBack: {
      type: String,
      default: '',
    },
    nidNumber: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    termsAgreed: {
      type: Boolean,
      default: false,
    },
    termsAgreedAt: {
      type: Date,
    },
    verificationSubmittedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    rewardPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    streakDays: {
      type: Number,
      default: 0,
    },
    lastActiveDate: {
      type: String, // YYYY-MM-DD
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
