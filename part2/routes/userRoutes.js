const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
}

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}
// GET all users (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id, username, email, role FROM Users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST a new user (simple signup)
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, [username, email, password, role]);

    res.status(201).json({ message: 'User registered', user_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(req.session.user);
});

// POST login (dummy version)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query(`
      SELECT user_id, username, role FROM Users
      WHERE email = ? AND password_hash = ?
    `, [email, password]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  // Clear the session cookie
  res.clearCookie('sessionId'); //

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get dogs owned by the logged-in user
router.get('/dogs', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in session' });
    }

    console.log('Fetching dogs for user ID:', userId);

    const query = `
      SELECT dog_id, name, size
      FROM Dogs
      WHERE owner_id = ?
      ORDER BY name
    `;

    const [dogs] = await db.query(query, [userId]);

    console.log('Found dogs:', dogs);

    res.json(dogs);
  } catch (error) {
    console.error('Error fetching user dogs:', error);
    res.status(500).json({ error: 'Failed to fetch dogs: ' + error.message });
  }
});


module.exports = router;