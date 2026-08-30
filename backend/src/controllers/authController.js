const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOTP } = require('../services/sms');

const JWT_SECRET = process.env.JWT_SECRET || 'vaani-jwt-secret-change-in-production';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'vaani-refresh-secret-change-in-production';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// The frontend exposes four plain-language workspaces. Keep the seeded backend
// roles behind this boundary so the demo buttons always land on usable APIs.
const DEMO_ROLE_BY_MOBILE = {
  '+919800000020': { name: 'Citizen', role: 'citizen' },
  '+919999000023': { name: 'Civic Admin', role: 'super_admin' },
  '+919999000004': { name: 'Area Supervisor', role: 'department_manager' },
  '+919999000005': { name: 'Field Worker', role: 'officer' },
};

function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
  );
  return { accessToken, refreshToken };
}

exports.sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

    let user = await User.findOne({ mobile });
    const demoProfile = DEMO_MODE ? DEMO_ROLE_BY_MOBILE[mobile] : null;

    // Auto-create citizen if not exists
    if (!user) {
      user = await User.create({
        name: demoProfile?.name || 'Citizen',
        mobile,
        role: demoProfile?.role || 'citizen',
      });
    } else if (demoProfile && user.role === 'citizen' && user.name === 'Citizen') {
      // Earlier demo runs may have auto-created these numbers as citizens.
      // Normalize only those placeholder records, never an existing named user.
      user.name = demoProfile.name;
      user.role = demoProfile.role;
    }

    // Generate OTP
    const otp = DEMO_MODE ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
    user.otp = otp;
    user.otp_expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    // Send OTP
    await sendOTP(mobile, otp);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      demo: DEMO_MODE ? 'OTP is 123456' : undefined,
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) return res.status(400).json({ error: 'Mobile and OTP required' });

    const user = await User.findOne({ mobile });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify OTP
    if (user.otp !== otp) return res.status(401).json({ error: 'Invalid OTP' });
    if (user.otp_expires && user.otp_expires < new Date()) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    // Clear OTP
    user.otp = undefined;
    user.otp_expires = undefined;
    user.last_login = new Date();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);
    user.refresh_token = refreshToken;
    await user.save();

    const populatedUser = await User.findById(user._id)
      .populate('supervisor_id', 'name')
      .populate('assigned_workers', 'name');

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        ward: user.ward,
        zone: user.zone,
        module: user.module,
        language_preference: user.language_preference,
        supervisor_id: populatedUser.supervisor_id?._id,
        supervisor_name: populatedUser.supervisor_id?.name,
        worker_profile: user.worker_profile,
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refresh_token !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user);
    user.refresh_token = tokens.refreshToken;
    await user.save();

    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

exports.logout = async (req, res) => {
  try {
    if (req.user) {
      req.user.refresh_token = undefined;
      await req.user.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-otp -otp_expires -refresh_token')
      .populate('department', 'name code');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const { name, language_preference } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (language_preference) updates.language_preference = language_preference;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .select('-otp -otp_expires -refresh_token')
      .populate('department', 'name code');

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        district: user.district,
        language_preference: user.language_preference,
        department: user.department,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
