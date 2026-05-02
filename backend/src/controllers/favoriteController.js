// Favorites controller - saved beneficiaries per user.

const Favorite = require('../models/Favorite');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

// GET /api/favorites
async function listFavorites(req, res, next) {
  try {
    const docs = await Favorite.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200);
    const items = docs.map((f) => f.toPublic());
    return res.json({ success: true, items, data: { items } });
  } catch (err) {
    return next(err);
  }
}

// POST /api/favorites
async function addFavorite(req, res, next) {
  try {
    const { name, accountType } = req.body;
    try {
      const fav = await Favorite.create({
        user: req.user._id,
        name: String(name).trim(),
        accountType,
      });
      return res.status(201).json({ success: true, ...fav.toPublic(), data: fav.toPublic() });
    } catch (e) {
      if (e && e.code === 11000) throw new ConflictError('Favorite already exists.');
      throw e;
    }
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/favorites/:id
async function deleteFavorite(req, res, next) {
  try {
    const id = req.params.id;
    const fav = await Favorite.findOneAndDelete({ _id: id, user: req.user._id });
    if (!fav) throw new NotFoundError('Favorite not found.');
    return res.json({ success: true, status: 'ok' });
  } catch (err) {
    if (err && err.name === 'CastError') return next(new NotFoundError('Favorite not found.'));
    return next(err);
  }
}

// POST /api/favorites/toggle
async function toggleFavorite(req, res, next) {
  try {
    const { name, accountType } = req.body;
    const cleanName = String(name).trim();
    if (!cleanName) throw new BadRequestError('name is required.');

    const existing = await Favorite.findOne({
      user: req.user._id,
      name: cleanName,
      accountType,
    });

    if (existing) {
      await existing.deleteOne();
      return res.json({ success: true, favorited: false, favorite: null });
    }

    const fav = await Favorite.create({
      user: req.user._id,
      name: cleanName,
      accountType,
    });
    return res.json({ success: true, favorited: true, favorite: fav.toPublic() });
  } catch (err) {
    return next(err);
  }
}

// GET /api/favorites/check?name=...&accountType=...
async function checkFavorite(req, res, next) {
  try {
    const name = String(req.query.name || '').trim();
    const accountType = String(req.query.accountType || req.query.account_type || '').trim();
    if (!name) throw new BadRequestError('name query param is required.');
    if (!accountType) throw new BadRequestError('accountType query param is required.');
    const fav = await Favorite.findOne({ user: req.user._id, name, accountType });
    return res.json({
      success: true,
      favorited: !!fav,
      favorite_id: fav ? fav._id.toString() : null,
      favoriteId: fav ? fav._id.toString() : null,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listFavorites,
  addFavorite,
  deleteFavorite,
  toggleFavorite,
  checkFavorite,
};
