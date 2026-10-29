const jwt = require('jsonwebtoken');
function signToken(user, role) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  return jwt.sign({ id: user._id.toString(), role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d', issuer: 'hovira-api', audience: 'hovira-client' });
}
module.exports = signToken;
