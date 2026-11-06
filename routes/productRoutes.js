
const router = require('express').Router();

const c = require('../controllers/productController');
const upload = require('../middleware/upload');

const { protectAdmin } = require('../middleware/auth');
const { requireObjectId } = require('../middleware/validate');

router.get('/', c.listProducts);

router.post(
    '/',
    protectAdmin,
    upload.array('images', 12),
    c.createProduct
);

router.post(
    '/upload-images',
    protectAdmin,
    upload.array('images', 12),
    c.uploadProductImages
);

router.get('/:slugOrId', c.getProduct);

router.put(
    '/:id',
    protectAdmin,
    requireObjectId('id'),
    upload.array('images', 12),
    c.updateProduct
);

// DELETE COMPLETE PRODUCT
router.delete(
    '/:id',
    protectAdmin,
    requireObjectId('id'),
    c.deleteProduct
);

// DELETE SINGLE IMAGE
router.delete(
    '/:id/images/:imageId',
    protectAdmin,
    requireObjectId('id'),
    c.deleteProductImage
);

// DELETE MULTIPLE IMAGES
router.delete(
    '/:id/images',
    protectAdmin,
    requireObjectId('id'),
    c.deleteMultipleProductImages
);

module.exports = router;
