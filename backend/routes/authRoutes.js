const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../utils/authRequest');

const router = express.Router();

/** All roles (user, stall owner, stall manager, admin, stall staff) authenticate via this route. */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        ...(user.phone ? { phone: user.phone } : {}),
        ...(user.staffStallId ? { staffStallId: user.staffStallId.toString() } : {}),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const REGISTER_ROLES = ['user', 'stall owner', 'stall manager', 'admin'];

router.post('/register', async (req, res) => {
  const { email, password, role, name } = req.body;
  const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const nameNorm = typeof name === 'string' ? name.trim() : '';
  const nicRaw = req.body.nic;
  const nicNorm =
    typeof nicRaw === 'string' && nicRaw.trim() !== '' ? nicRaw.trim() : undefined;

  if (!emailNorm || !password || !nameNorm) {
    return res.status(400).json({ message: 'Please provide name, email and password' });
  }

  const resolvedRole = role || 'user';
  if (!REGISTER_ROLES.includes(resolvedRole)) {
    return res.status(400).json({
      message: `Invalid role. Allowed: ${REGISTER_ROLES.join(', ')}`,
    });
  }

  try {
    const userExists = await User.findOne({ email: emailNorm });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = new User({
      email: emailNorm,
      password,
      role: resolvedRole,
      name: nameNorm,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      ...(nicNorm !== undefined ? { nic: nicNorm } : {}),
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000 && err.keyPattern) {
      const dupField = Object.keys(err.keyPattern)[0];
      if (dupField === 'email') {
        return res.status(400).json({ message: 'An account with this email already exists.' });
      }
      if (dupField === 'nic') {
        return res.status(400).json({ message: 'This NIC is already registered.' });
      }
      return res.status(400).json({ message: 'Some of this information is already in use.' });
    }
    if (err.name === 'ValidationError' && err.errors) {
      const first = Object.values(err.errors)[0];
      const msg =
        typeof first?.message === 'string' ? first.message : 'Invalid registration data.';
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
