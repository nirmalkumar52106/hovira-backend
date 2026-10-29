const router = require('express').Router(); 
const c = require('../controllers/couponController');
 const { protectAdmin, protectCustomer } = require('../middleware/auth');
  const { requireObjectId } = require('../middleware/validate');
router.post('/validate', protectCustomer, c.validateCoupon);
 router.get('/', (req, res, next) => { if (req.query.admin === 'true') return protectAdmin(req, res, next); next(); }, c.listCoupons);
router.post('/', protectAdmin, c.createCoupon); router.patch('/:id', protectAdmin, requireObjectId('id'), c.updateCoupon); 
router.delete('/:id', protectAdmin, requireObjectId('id'), c.deleteCoupon);
module.exports = router;
