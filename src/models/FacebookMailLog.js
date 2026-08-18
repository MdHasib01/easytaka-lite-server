const mongoose = require('mongoose');

const facebookMailLogSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
    },
    subject: {
      type: String,
      default: '',
    },
    from: {
      type: String,
      default: '',
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    isOtp: {
      type: Boolean,
      default: false,
    },
    otpCode: {
      type: String,
      default: '',
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FacebookMailLog', facebookMailLogSchema);
