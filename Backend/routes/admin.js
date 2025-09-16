const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const QRCode = require('../models/QRCode');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All routes require admin access
router.use(protect, restrictTo('admin'));

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Private (Admin only)
router.get('/students', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, department, year, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { studentId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by department
    if (department) {
      query.department = department;
    }

    // Filter by year
    if (year) {
      query.year = parseInt(year);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const students = await Student.find(query)
      .populate('user', 'name email role isActive createdAt')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Student.countDocuments(query);

    res.json({
      success: true,
      data: {
        students,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching students'
    });
  }
});

// @desc    Get single student
// @route   GET /api/admin/students/:id
// @access  Private (Admin only)
router.get('/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', 'name email role isActive createdAt');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: { student }
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching student'
    });
  }
});

// @desc    Update student profile
// @route   PUT /api/admin/students/:id
// @access  Private (Admin only)
router.put('/students/:id', [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('phoneNumber').optional().matches(/^[0-9]{10}$/).withMessage('Please enter a valid 10-digit phone number'),
  body('department').optional().trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('year').optional().isInt({ min: 1, max: 4 }).withMessage('Year must be between 1 and 4'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
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

    const { name, email, phoneNumber, department, year, isActive } = req.body;

    const student = await Student.findById(req.params.id).populate('user');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Update user info
    const userUpdates = {};
    if (name) userUpdates.name = name;
    if (email) userUpdates.email = email;
    if (isActive !== undefined) userUpdates.isActive = isActive;

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(student.user._id, userUpdates);
    }

    // Update student info
    const studentUpdates = {};
    if (phoneNumber) studentUpdates.phoneNumber = phoneNumber;
    if (department) studentUpdates.department = department;
    if (year) studentUpdates.year = year;

    if (Object.keys(studentUpdates).length > 0) {
      await Student.findByIdAndUpdate(req.params.id, studentUpdates);
    }

    // Get updated student data
    const updatedStudent = await Student.findById(req.params.id)
      .populate('user', 'name email role isActive createdAt');

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: { student: updatedStudent }
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating student'
    });
  }
});

// @desc    Delete student
// @route   DELETE /api/admin/students/:id
// @access  Private (Admin only)
router.delete('/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('user');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Delete student and user
    await Student.findByIdAndDelete(req.params.id);
    await User.findByIdAndDelete(student.user._id);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting student'
    });
  }
});

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = {};

    // Add date filters if provided
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Get basic statistics
    const [
      totalStudents,
      activeStudents,
      totalAttendance,
      pendingLeaves,
      approvedLeaves,
      rejectedLeaves,
      activeQRCodes
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ 'user.isActive': true }),
      Attendance.countDocuments(),
      Leave.countDocuments({ status: 'pending' }),
      Leave.countDocuments({ status: 'approved' }),
      Leave.countDocuments({ status: 'rejected' }),
      QRCode.countDocuments({ isActive: true })
    ]);

    // Get attendance statistics for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get monthly attendance trend
    const monthlyTrend = await Attendance.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          totalCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      },
      {
        $limit: 30
      }
    ]);

    // Get department-wise statistics
    const departmentStats = await Student.aggregate([
      {
        $group: {
          _id: '$department',
          studentCount: { $sum: 1 },
          avgAttendance: { $avg: '$attendancePercentage' }
        }
      },
      {
        $sort: { studentCount: -1 }
      }
    ]);

    // Get recent activities
    const recentActivities = await Promise.all([
      Attendance.find().populate('student', 'studentId name').sort({ createdAt: -1 }).limit(5),
      Leave.find().populate('student', 'studentId name').sort({ appliedAt: -1 }).limit(5)
    ]);

    const todayStats = {
      present: 0,
      absent: 0,
      late: 0
    };

    todayAttendance.forEach(stat => {
      todayStats[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          activeStudents,
          totalAttendance,
          pendingLeaves,
          approvedLeaves,
          rejectedLeaves,
          activeQRCodes
        },
        todayAttendance: todayStats,
        monthlyTrend,
        departmentStats,
        recentActivities: {
          attendance: recentActivities[0],
          leaves: recentActivities[1]
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard data'
    });
  }
});

// @desc    Get attendance reports
// @route   GET /api/admin/reports/attendance
// @access  Private (Admin only)
router.get('/reports/attendance', async (req, res) => {
  try {
    const { startDate, endDate, department, year, format = 'json' } = req.query;
    const matchQuery = {};

    // Add date filters
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
    }

    // Add department filter
    if (department) {
      const students = await Student.find({ department }).select('_id');
      const studentIds = students.map(s => s._id);
      matchQuery.student = { $in: studentIds };
    }

    // Add year filter
    if (year) {
      const students = await Student.find({ year: parseInt(year) }).select('_id');
      const studentIds = students.map(s => s._id);
      matchQuery.student = { $in: studentIds };
    }

    const attendance = await Attendance.find(matchQuery)
      .populate('student', 'studentId name department year')
      .sort({ date: -1 });

    // Generate summary statistics
    const summary = await Attendance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          }
        }
      }
    ]);

    const summaryData = summary[0] || {
      totalRecords: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0
    };

    res.json({
      success: true,
      data: {
        attendance,
        summary: {
          ...summaryData,
          attendancePercentage: summaryData.totalRecords > 0 
            ? Math.round((summaryData.presentCount / summaryData.totalRecords) * 100) 
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get attendance reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching attendance reports'
    });
  }
});

// @desc    Export data
// @route   GET /api/admin/export
// @access  Private (Admin only)
router.get('/export', async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    
    if (!type || !['students', 'attendance', 'leaves'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Export type must be students, attendance, or leaves'
      });
    }

    let data = [];
    let filename = '';

    switch (type) {
      case 'students':
        data = await Student.find().populate('user', 'name email createdAt');
        filename = 'students_export.json';
        break;
      
      case 'attendance':
        const matchQuery = {};
        if (startDate || endDate) {
          matchQuery.date = {};
          if (startDate) matchQuery.date.$gte = new Date(startDate);
          if (endDate) matchQuery.date.$lte = new Date(endDate);
        }
        data = await Attendance.find(matchQuery)
          .populate('student', 'studentId name department year');
        filename = 'attendance_export.json';
        break;
      
      case 'leaves':
        data = await Leave.find()
          .populate('student', 'studentId name')
          .populate('reviewedBy', 'name email');
        filename = 'leaves_export.json';
        break;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({
      success: true,
      data,
      exportedAt: new Date(),
      totalRecords: data.length
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error exporting data'
    });
  }
});

module.exports = router;
