const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Stall = require('../models/Stall');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

async function authUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const payload = jwt.verify(authHeader.slice('Bearer '.length).trim(), JWT_SECRET);
    if (!payload || !mongoose.Types.ObjectId.isValid(payload.id)) return null;
    const user = await User.findById(payload.id).select('_id role staffStallId');
    return user;
  } catch {
    return null;
  }
}

function isStallOwnerUser(stallDoc, ownerUserDoc) {
  if (!ownerUserDoc || !stallDoc) return false;
  return stallDoc.manager.toString() === ownerUserDoc._id.toString();
}

async function stallCanManageMeals(stallId, actingUserId, actingRole, staffStallId) {
  const stall = await Stall.findById(stallId);
  if (!stall) return { ok: false, stall: null };
  const sid = stall._id.toString();
  const ownerMatch = stall.manager.toString() === actingUserId;
  const staffMatch = actingRole === 'stall staff' && staffStallId && sid === staffStallId.toString();
  if (actingRole === 'stall owner' && ownerMatch) return { ok: true, stall };
  if (actingRole === 'stall staff' && staffMatch) return { ok: true, stall };
  return { ok: false, stall };
}

module.exports = {
  JWT_SECRET,
  authUserFromRequest,
  isStallOwnerUser,
  stallCanManageMeals,
};
