const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
    maxlength: [500, 'Reason cannot be more than 500 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  adminNotes: {
    type: String,
    default: null,
    maxlength: [300, 'Admin notes cannot be more than 300 characters']
  },
  leaveType: {
    type: String,
    enum: ['sick', 'personal', 'emergency', 'other'],
    default: 'personal'
  },
  totalDays: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
leaveSchema.index({ student: 1, status: 1 });
leaveSchema.index({ status: 1, appliedAt: -1 });

// Calculate total days before saving
leaveSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    this.totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end days
  }
  next();
});

// Validate that end date is after start date
leaveSchema.pre('save', function(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    const error = new Error('End date must be after start date');
    return next(error);
  }
  next();
});

module.exports = mongoose.model('Leave', leaveSchema);
