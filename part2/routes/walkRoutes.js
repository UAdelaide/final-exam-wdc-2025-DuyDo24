const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (!req.session.user || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

// GET walk requests - modified to show user's own requests when accessed from owner dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.user.role;

    let query;
    let params;

    if (userRole === 'walker') {
      // Walkers see all open requests
      query = `
        SELECT wr.*, d.name AS dog_name, d.size, u.username AS owner_name
        FROM WalkRequests wr
        JOIN Dogs d ON wr.dog_id = d.dog_id
        JOIN Users u ON d.owner_id = u.user_id
        WHERE wr.status = 'open'
      `;
      params = [];
    } else {
      // Owners see their own requests
      query = `
        SELECT wr.*, d.name AS dog_name, d.size, u.username AS owner_name
        FROM WalkRequests wr
        JOIN Dogs d ON wr.dog_id = d.dog_id
        JOIN Users u ON d.owner_id = u.user_id
        WHERE d.owner_id = ?
        ORDER BY wr.requested_time DESC
      `;
      params = [userId];
    }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('SQL Error:', error);
    res.status(500).json({ error: 'Failed to fetch walk requests' });
  }
});

// POST a new walk request (from owner) - added authentication and validation
router.post('/', requireAuth, async (req, res) => {
  const { dog_id, requested_time, duration_minutes, location } = req.body;
  const userId = req.session.userId;

  try {
    // Verify the dog belongs to the logged-in user
    const [dogCheck] = await db.query(`
      SELECT dog_id FROM Dogs WHERE dog_id = ? AND owner_id = ?
    `, [dog_id, userId]);

    if (dogCheck.length === 0) {
      return res.status(403).json({ error: 'You can only create walk requests for your own dogs' });
    }

    const [result] = await db.query(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location)
      VALUES (?, ?, ?, ?)
    `, [dog_id, requested_time, duration_minutes, location]);

    res.status(201).json({ message: 'Walk request created', request_id: result.insertId });
  } catch (error) {
    console.error('SQL Error:', error);
    res.status(500).json({ error: 'Failed to create walk request' });
  }
});

// POST an application to walk a dog (from walker)
router.post('/:id/apply', requireAuth, async (req, res) => {
  const requestId = req.params.id;
  const walkerId = req.session.userId; // Use session user ID instead of body

  try {
    // Verify user is a walker
    if (req.session.user.role !== 'walker') {
      return res.status(403).json({ error: 'Only walkers can apply for walks' });
    }

    await db.query(`
      INSERT INTO WalkApplications (request_id, walker_id)
      VALUES (?, ?)
    `, [requestId, walkerId]);

    await db.query(`
      UPDATE WalkRequests
      SET status = 'accepted'
      WHERE request_id = ?
    `, [requestId]);

    res.status(201).json({ message: 'Application submitted' });
  } catch (error) {
    console.error('SQL Error:', error);
    res.status(500).json({ error: 'Failed to apply for walk' });
  }
});

module.exports = router;