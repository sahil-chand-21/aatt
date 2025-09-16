const express = require('express');
const { body, validationResult } = require('express-validator');
const Leave = require('../models/Leave');
const Student = require('../models/Student');
const User = require('../models/User');
const { protect, restrictTo, getStudentProfile } = require('../middleware/auth');

const router = express.Router();

// @desc    Apply for leave
// @route   POST /api/leave
// @access  Private (Students only)
router.post('/', protect, restrictTo('student'), getStudentProfile, [
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('reason').trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters'),
  body('leaveType').optional().isIn(['sick', 'personal', 'emergency', 'other']).withMessage('Invalid leave type')
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

    const { startDate, endDate, reason, leaveType = 'personal' } = req.body;
    const student = req.student;

    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Check if start date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (new Date(startDate) < today) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be in the past'
      });
    }

    // Check for overlapping leave applications
    const overlappingLeave = await Leave.findOne({
      student: student._id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) }
        }
      ]
    });

    if (overlappingLeave) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave application for this period'
      });
    }

    // Create leave application
    const leave = await Leave.create({
      student: student._id,
      studentId: student.studentId,
      studentName: req.user.name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      leaveType
    });

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: {
        leave: {
          id: leave._id,
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: leave.reason,
          leaveType: leave.leaveType,
          status: leave.status,
          totalDays: leave.totalDays,
          appliedAt: leave.appliedAt
        }
      }
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error submitting leave application'
    });
  }
});

// @desc    Get leave applications
// @route   GET /api/leave
// @access  Private
router.get('/', protect, getStudentProfile, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, studentId } = req.query;
    const query = {};

    // If admin, can view all leaves or filter by student
    if (req.user.role === 'admin') {
      if (studentId) {
        const student = await Student.findOne({ studentId });
        if (!student) {
          return res.status(404).json({
            success: false,
            message: 'Student not found'
          });
        }
        query.student = student._id;
      }
    } else {
      // Students can only see their own leaves
      if (!req.student) {
        return res.status(400).json({
          success: false,
          message: 'Student profile not found'
        });
      }
      query.student = req.student._id;
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const leaves = await Leave.find(query)
      .populate('student', 'studentId name email')
      .populate('reviewedBy', 'name email')
      .sort({ appliedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Leave.countDocuments(query);

    res.json({
      success: true,
      data: {
        leaves,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching leave applications'
    });
  }
});

// @desc    Get single leave application
// @route   GET /api/leave/:id
// @access  Private
router.get('/:id', protect, getStudentProfile, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('student', 'studentId name email')
      .populate('reviewedBy', 'name email');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    // Check if user can view this leave
    if (req.user.role === 'student' && leave.student._id.toString() !== req.student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { leave }
    });
  } catch (error) {
    console.error('Get leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching leave application'
    });
  }
});

// @desc    Update leave application status (Admin only)
// @route   PUT /api/leave/:id/status
// @access  Private (Admin only)
router.put('/:id/status', protect, restrictTo('admin'), [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('adminNotes').optional().trim().isLength({ max: 300 }).withMessage('Admin notes cannot exceed 300 characters')
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

    const { status, adminNotes } = req.body;

    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave application has already been reviewed'
      });
    }

    // Update leave status
    leave.status = status;
    leave.reviewedAt = new Date();
    leave.reviewedBy = req.user._id;
    if (adminNotes) {
      leave.adminNotes = adminNotes;
    }

    await leave.save();

    // Populate the updated leave
    await leave.populate('student', 'studentId name email');
    await leave.populate('reviewedBy', 'name email');

    res.json({
      success: true,
      message: `Leave application ${status} successfully`,
      data: { leave }
    });
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating leave status'
    });
  }
});

// @desc    Update leave application (Student only)
// @route   PUT /api/leave/:id
// @access  Private (Students only)
router.put('/:id', protect, restrictTo('student'), getStudentProfile, [
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  body('reason').optional().trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters'),
  body('leaveType').optional().isIn(['sick', 'personal', 'emergency', 'other']).withMessage('Invalid leave type')
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

    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    // Check if user owns this leave
    if (leave.student.toString() !== req.student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if leave can be updated (only pending leaves)
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update leave application that has been reviewed'
      });
    }

    const { startDate, endDate, reason, leaveType } = req.body;
    const updates = {};

    if (startDate) updates.startDate = new Date(startDate);
    if (endDate) updates.endDate = new Date(endDate);
    if (reason) updates.reason = reason;
    if (leaveType) updates.leaveType = leaveType;

    // Validate dates if both are provided
    if (updates.startDate && updates.endDate && updates.endDate < updates.startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Update leave
    const updatedLeave = await Leave.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('student', 'studentId name email');

    res.json({
      success: true,
      message: 'Leave application updated successfully',
      data: { leave: updatedLeave }
    });
  } catch (error) {
    console.error('Update leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating leave application'
    });
  }
});

// @desc    Delete leave application
// @route   DELETE /api/leave/:id
// @access  Private (Students only)
router.delete('/:id', protect, restrictTo('student'), getStudentProfile, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    // Check if user owns this leave
    if (leave.student.toString() !== req.student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if leave can be deleted (only pending leaves)
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete leave application that has been reviewed'
      });
    }

    await Leave.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Leave application deleted successfully'
    });
  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting leave application'
    });
  }
});

// @desc    Get leave statistics
// @route   GET /api/leave/stats
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

    // Get leave statistics
    const stats = await Leave.aggregate([
      {
        $match: { student: studentId }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }
      }
    ]);

    const result = {
      pending: { count: 0, totalDays: 0 },
      approved: { count: 0, totalDays: 0 },
      rejected: { count: 0, totalDays: 0 }
    };

    stats.forEach(stat => {
      result[stat._id] = {
        count: stat.count,
        totalDays: stat.totalDays
      };
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get leave stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching leave statistics'
    });
  }
});

module.exports = router;
