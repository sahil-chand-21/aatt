const express = require('express');
const { body, validationResult } = require('express-validator');
const QRCode = require('../models/QRCode');
const QRCodeLib = require('qrcode');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// @desc    Generate QR code
// @route   POST /api/qr/generate
// @access  Private (Admin only)
router.post('/generate', protect, restrictTo('admin'), [
  body('sessionType').isIn(['check-in', 'check-out']).withMessage('Session type must be check-in or check-out'),
  body('expiresInMinutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Expires in minutes must be between 1 and 1440'),
  body('maxUses').optional().isInt({ min: 1, max: 1000 }).withMessage('Max uses must be between 1 and 1000'),
  body('location.latitude').optional().isFloat().withMessage('Latitude must be a valid number'),
  body('location.longitude').optional().isFloat().withMessage('Longitude must be a valid number'),
  body('location.radius').optional().isInt({ min: 10, max: 1000 }).withMessage('Radius must be between 10 and 1000 meters')
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

    const { 
      sessionType, 
      expiresInMinutes = 30, 
      maxUses = 1, 
      location 
    } = req.body;

    // Generate unique QR code data
    const qrData = {
      id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
      sessionType,
      generatedAt: new Date(),
      generatedBy: req.user._id
    };

    // Generate QR code image
    const qrCodeImage = await QRCodeLib.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Create QR code record
    const qrCode = await QRCode.create({
      code: qrData.id,
      expiresAt,
      sessionType,
      location: location || null,
      generatedBy: req.user._id,
      maxUses
    });

    res.status(201).json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrCode: {
          id: qrCode._id,
          code: qrCode.code,
          sessionType: qrCode.sessionType,
          expiresAt: qrCode.expiresAt,
          maxUses: qrCode.maxUses,
          currentUses: qrCode.currentUses,
          isActive: qrCode.isActive,
          location: qrCode.location
        },
        qrCodeImage,
        expiresInMinutes
      }
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating QR code'
    });
  }
});

// @desc    Validate QR code
// @route   POST /api/qr/validate
// @access  Private
router.post('/validate', protect, [
  body('qrCodeData').notEmpty().withMessage('QR code data is required')
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

    const { qrCodeData } = req.body;

    // Parse QR code data
    let parsedData;
    try {
      parsedData = JSON.parse(qrCodeData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    // Find QR code in database
    const qrCode = await QRCode.findOne({ code: parsedData.id });
    if (!qrCode) {
      return res.status(400).json({
        success: false,
        message: 'QR code not found'
      });
    }

    // Check if QR code is valid
    if (!qrCode.canBeUsed()) {
      return res.status(400).json({
        success: false,
        message: 'QR code is expired or has reached maximum uses'
      });
    }

    res.json({
      success: true,
      message: 'QR code is valid',
      data: {
        qrCodeId: qrCode._id,
        sessionType: qrCode.sessionType,
        expiresAt: qrCode.expiresAt,
        location: qrCode.location,
        remainingUses: qrCode.maxUses - qrCode.currentUses
      }
    });
  } catch (error) {
    console.error('Validate QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error validating QR code'
    });
  }
});

// @desc    Get QR codes
// @route   GET /api/qr
// @access  Private (Admin only)
router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, sessionType, isActive } = req.query;
    const query = {};

    // Filter by session type
    if (sessionType) {
      query.sessionType = sessionType;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const qrCodes = await QRCode.find(query)
      .populate('generatedBy', 'name email')
      .populate('usedBy.student', 'studentId name')
      .sort({ generatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await QRCode.countDocuments(query);

    res.json({
      success: true,
      data: {
        qrCodes,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get QR codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching QR codes'
    });
  }
});

// @desc    Get single QR code
// @route   GET /api/qr/:id
// @access  Private (Admin only)
router.get('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const qrCode = await QRCode.findById(req.params.id)
      .populate('generatedBy', 'name email')
      .populate('usedBy.student', 'studentId name');

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }

    res.json({
      success: true,
      data: { qrCode }
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching QR code'
    });
  }
});

// @desc    Deactivate QR code
// @route   PUT /api/qr/:id/deactivate
// @access  Private (Admin only)
router.put('/:id/deactivate', protect, restrictTo('admin'), async (req, res) => {
  try {
    const qrCode = await QRCode.findById(req.params.id);
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }

    qrCode.isActive = false;
    await qrCode.save();

    res.json({
      success: true,
      message: 'QR code deactivated successfully',
      data: { qrCode }
    });
  } catch (error) {
    console.error('Deactivate QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deactivating QR code'
    });
  }
});

// @desc    Get QR code statistics
// @route   GET /api/qr/stats
// @access  Private (Admin only)
router.get('/stats', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = {};

    // Add date filters if provided
    if (startDate || endDate) {
      matchQuery.generatedAt = {};
      if (startDate) matchQuery.generatedAt.$gte = new Date(startDate);
      if (endDate) matchQuery.generatedAt.$lte = new Date(endDate);
    }

    // Get QR code statistics
    const stats = await QRCode.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$sessionType',
          totalGenerated: { $sum: 1 },
          totalUsed: { $sum: '$currentUses' },
          activeCodes: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Get overall statistics
    const overallStats = await QRCode.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalGenerated: { $sum: 1 },
          totalUsed: { $sum: '$currentUses' },
          activeCodes: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          },
          expiredCodes: {
            $sum: {
              $cond: [{ $lt: ['$expiresAt', new Date()] }, 1, 0]
            }
          }
        }
      }
    ]);

    const result = {
      checkIn: { totalGenerated: 0, totalUsed: 0, activeCodes: 0 },
      checkOut: { totalGenerated: 0, totalUsed: 0, activeCodes: 0 },
      overall: overallStats[0] || { totalGenerated: 0, totalUsed: 0, activeCodes: 0, expiredCodes: 0 }
    };

    stats.forEach(stat => {
      result[stat._id] = {
        totalGenerated: stat.totalGenerated,
        totalUsed: stat.totalUsed,
        activeCodes: stat.activeCodes
      };
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get QR code stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching QR code statistics'
    });
  }
});

// @desc    Clean up expired QR codes
// @route   DELETE /api/qr/cleanup
// @access  Private (Admin only)
router.delete('/cleanup', protect, restrictTo('admin'), async (req, res) => {
  try {
    const result = await QRCode.deleteMany({
      expiresAt: { $lt: new Date() },
      isActive: false
    });

    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} expired QR codes`,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    console.error('Cleanup QR codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cleaning up QR codes'
    });
  }
});

module.exports = router;
