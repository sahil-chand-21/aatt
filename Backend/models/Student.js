const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [1, 'Year must be at least 1'],
    max: [4, 'Year cannot be more than 4']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  totalAttendance: {
    type: Number,
    default: 0
  },
  presentDays: {
    type: Number,
    default: 0
  },
  totalDays: {
    type: Number,
    default: 0
  },
  attendancePercentage: {
    type: Number,
    default: 0,
    min: [0, 'Attendance percentage cannot be negative'],
    max: [100, 'Attendance percentage cannot exceed 100']
  }
}, {
  timestamps: true
});

// Calculate attendance percentage before saving
studentSchema.pre('save', function(next) {
  if (this.totalDays > 0) {
    this.attendancePercentage = Math.round((this.presentDays / this.totalDays) * 100);
  }
  next();
});

module.exports = mongoose.model('Student', studentSchema);
