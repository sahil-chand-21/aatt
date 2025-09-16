const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sessionType: {
    type: String,
    enum: ['check-in', 'check-out'],
    required: true
  },
  location: {
    latitude: {
      type: Number,
      required: false
    },
    longitude: {
      type: Number,
      required: false
    },
    radius: {
      type: Number,
      default: 100 // meters
    }
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usedBy: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  maxUses: {
    type: Number,
    default: 1
  },
  currentUses: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
qrCodeSchema.index({ code: 1 });
qrCodeSchema.index({ expiresAt: 1 });
qrCodeSchema.index({ isActive: 1 });

// Check if QR code is expired
qrCodeSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Check if QR code can be used
qrCodeSchema.methods.canBeUsed = function() {
  return this.isActive && !this.isExpired() && this.currentUses < this.maxUses;
};

// Mark QR code as used
qrCodeSchema.methods.markAsUsed = function(studentId) {
  if (this.canBeUsed()) {
    this.usedBy.push({
      student: studentId,
      usedAt: new Date()
    });
    this.currentUses += 1;
    
    // Deactivate if max uses reached
    if (this.currentUses >= this.maxUses) {
      this.isActive = false;
    }
    
    return true;
  }
  return false;
};

module.exports = mongoose.model('QRCode', qrCodeSchema);
