const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkIn: {
    type: Date,
    default: null
  },
  checkOut: {
    type: Date,
    default: null
  },
  attendancePercentage: {
    type: Number,
    default: 0
  },
  location: {
    latitude: {
      type: Number,
      required: false
    },
    longitude: {
      type: Number,
      required: false
    }
  },
  deviceInfo: {
    type: String,
    default: null
  },
  qrCodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QRCode',
    default: null
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    default: 'absent'
  },
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
attendanceSchema.index({ student: 1, date: 1 });
attendanceSchema.index({ studentId: 1, date: 1 });

// Calculate attendance percentage
attendanceSchema.pre('save', function(next) {
  if (this.checkIn && this.checkOut) {
    const duration = this.checkOut - this.checkIn;
    const hours = duration / (1000 * 60 * 60);
    
    // If student was present for more than 4 hours, mark as present
    if (hours >= 4) {
      this.status = 'present';
      this.attendancePercentage = 100;
    } else if (hours >= 2) {
      this.status = 'late';
      this.attendancePercentage = 50;
    } else {
      this.status = 'absent';
      this.attendancePercentage = 0;
    }
  } else if (this.checkIn) {
    this.status = 'late';
    this.attendancePercentage = 50;
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
