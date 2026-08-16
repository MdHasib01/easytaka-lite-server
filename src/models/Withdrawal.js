const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    points: {
      type: Number,
      required: true,
      min: 1,
    },
    amountBDT: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentMethod: {
      type: String,
      enum: ['bkash', 'nagad', 'rocket'],
      default: 'bkash',
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['personal', 'agent', 'merchant'],
      default: 'personal',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    transactionId: {
      type: String,
      default: '',
      trim: true,
    },
    adminNote: {
      type: String,
      default: '',
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    processedAt: {
      type: Date,
    },
    cycleInfo: {
      joinDate: { type: Date },
      daysSinceJoin: { type: Number, default: 0 },
      cycleNumber: { type: Number, default: 1 },
      isEligible: { type: Boolean, default: true },
      approvedTasksCount: { type: Number, default: 0 },
      approvedAccountsCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
