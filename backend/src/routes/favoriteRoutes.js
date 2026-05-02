// Favorite routes - mounted under /api/favorites.

const express = require('express');
const ctl = require('../controllers/favoriteController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

router.use(requireAuth);

router.get('/', ctl.listFavorites);
router.post('/', validate(schemas.favoriteSchema), ctl.addFavorite);
router.post('/toggle', validate(schemas.favoriteSchema), ctl.toggleFavorite);
router.get('/check', validate(schemas.favoriteCheckSchema, 'query'), ctl.checkFavorite);
router.delete('/:id', ctl.deleteFavorite);

module.exports = router;
