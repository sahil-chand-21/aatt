const express = require('express');
const { body, validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const QRCode = require('../models/QRCode');
const { protect, restrictTo, getStudentProfile } = require('../middleware/auth');

const router = express.Router();

// @desc    Mark attendance (check-in/check-out)
// @route   POST /api/attendance
// @access  Private (Students only)
router.post('/', protect, restrictTo('student'), getStudentProfile, [
  body('qrCodeId').notEmpty().withMessage('QR Code ID is required'),
  body('action').isIn(['check-in', 'check-out']).withMessage('Action must be check-in or check-out')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { qrCodeId, action, location, deviceInfo } = req.body;
    const student = req.student;

    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Find and validate QR code
    const qrCode = await QRCode.findById(qrCodeId);
    if (!qrCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code'
      });
    }

    // Check if QR code can be used
    if (!qrCode.canBeUsed()) {
      return res.status(400).json({
        success: false,
        message: 'QR code is expired or already used'
      });
    }

    // Check if QR code session type matches action
    if (qrCode.sessionType !== action) {
      return res.status(400).json({
        success: false,
        message: `This QR code is for ${qrCode.sessionType}, not ${action}`
      });
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's attendance record
    let attendance = await Attendance.findOne({
      student: student._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    // Create new attendance record if it doesn't exist
    if (!attendance) {
      attendance = await Attendance.create({
        student: student._id,
        studentId: student.studentId,
        date: today,
        location: location || null,
        deviceInfo: deviceInfo || req.headers['user-agent']
      });
    }

    // Update attendance based on action
    if (action === 'check-in') {
      if (attendance.checkIn) {
        return res.status(400).json({
          success: false,
          message: 'Already checked in today'
        });
      }
      attendance.checkIn = new Date();
      attendance.qrCodeId = qrCodeId;
    } else if (action === 'check-out') {
      if (!attendance.checkIn) {
        return res.status(400).json({
          success: false,
          message: 'Must check in before checking out'
        });
      }
      if (attendance.checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Already checked out today'
        });
      }
      attendance.checkOut = new Date();
    }

    // Save attendance
    await attendance.save();

    // Mark QR code as used
    qrCode.markAsUsed(student._id);
    await qrCode.save();

    // Update student's attendance statistics
    await updateStudentAttendanceStats(student._id);

    res.json({
      success: true,
      message: `${action} successful`,
      data: {
        attendance: {
          id: attendance._id,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status: attendance.status,
          attendancePercentage: attendance.attendancePercentage
        }
      }
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error marking attendance'
    });
  }
});

// @desc    Get attendance history
// @route   GET /api/attendance
// @access  Private
router.get('/', protect, getStudentProfile, async (req, res) => {
  try {
    const { page = 1, limit = 30, startDate, endDate } = req.query;
    const query = {};

    // If student, only get their attendance
    if (req.user.role === 'student') {
      if (!req.student) {
        return res.status(400).json({
          success: false,
          message: 'Student profile not found'
        });
      }
      query.student = req.student._id;
    }

    // Add date filters if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const attendances = await Attendance.find(query)
      .populate('student', 'studentId name email')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(query);

    res.json({
      success: true,
      data: {
        attendances,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching attendance'
    });
  }
});

// @desc    Get attendance statistics
// @route   GET /api/attendance/stats
// @access  Private
router.get('/stats', protect, getStudentProfile, async (req, res) => {
  try {
    let studentId = null;

    if (req.user.role === 'student') {
      if (!req.student) {
        return res.status(400).json({
          success: false,
          message: 'Student profile not found'
        });
      }
      studentId = req.student._id;
    } else if (req.query.studentId) {
      // Admin can get stats for specific student
      const student = await Student.findOne({ studentId: req.query.studentId });
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }
      studentId = student._id;
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    // Get current month stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyStats = await Attendance.aggregate([
      {
        $match: {
          student: studentId,
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
            }
          },
          lateDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'late'] }, 1, 0]
            }
          },
          absentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Get overall stats
    const overallStats = await Attendance.aggregate([
      {
        $match: { student: studentId }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
            }
          },
          lateDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'late'] }, 1, 0]
            }
          },
          absentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const monthly = monthlyStats[0] || { totalDays: 0, presentDays: 0, lateDays: 0, absentDays: 0 };
    const overall = overallStats[0] || { totalDays: 0, presentDays: 0, lateDays: 0, absentDays: 0 };

    res.json({
      success: true,
      data: {
        monthly: {
          ...monthly,
          attendancePercentage: monthly.totalDays > 0 ? Math.round((monthly.presentDays / monthly.totalDays) * 100) : 0
        },
        overall: {
          ...overall,
          attendancePercentage: overall.totalDays > 0 ? Math.round((overall.presentDays / overall.totalDays) * 100) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching attendance statistics'
    });
  }
});

// Helper function to update student attendance statistics
const updateStudentAttendanceStats = async (studentId) => {
  try {
    const stats = await Attendance.aggregate([
      {
        $match: { student: studentId }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
            }
          }
        }
      }
    ]);

    if (stats.length > 0) {
      const { totalDays, presentDays } = stats[0];
      const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      await Student.findByIdAndUpdate(studentId, {
        totalDays,
        presentDays,
        attendancePercentage
      });
    }
  } catch (error) {
    console.error('Error updating student attendance stats:', error);
  }
};

module.exports = router;
