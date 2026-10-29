const mongoose = require('mongoose');
function requireObjectId(param = 'id') {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[param])) return res.status(400).json({ message: `Invalid ${param}.` });
    next();
  };
}
module.exports = { requireObjectId };
