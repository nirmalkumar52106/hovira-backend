const router = require('express').Router(); 
const rateLimit = require('express-rate-limit');
 const c = require('../controllers/authController');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many login attempts. Try again later.' } });
router.post('/customers/register', authLimiter, c.registerCustomer);
 router.post('/customers/login', authLimiter, c.loginCustomer); 
 router.post('/admin/login', authLimiter, c.loginAdmin);
module.exports = router;
