// Joi validation schemas for incoming request bodies and a small middleware
// factory that turns a schema into an Express middleware.

const Joi = require('joi');
const { BadRequestError } = require('./errors');

// Pakistan formats from the original frontend.
const PK_PHONE_RE = /^03\d{2}-\d{7}$/;
const PK_CNIC_RE = /^\d{5}-\d{7}-\d{1}$/;

// ---------- Schemas ----------

const signupSchema = Joi.object({
  fullName: Joi.string().trim().max(128).allow('', null),
  username: Joi.string().trim().min(3).max(64).pattern(/^[a-zA-Z0-9_.-]+$/)
    .required()
    .messages({ 'string.pattern.base': 'Username may only contain letters, digits, dot, underscore and dash.' }),
  password: Joi.string().min(10).max(128).required()
    .messages({ 'string.min': 'Password must be at least 10 characters long.' }),
  phone: Joi.string().trim().pattern(PK_PHONE_RE).required()
    .messages({ 'string.pattern.base': 'Phone must be in the format 03XX-XXXXXXX.' }),
  cnic: Joi.string().trim().pattern(PK_CNIC_RE).required()
    .messages({ 'string.pattern.base': 'CNIC must be in the format #####-#######-#.' }),
  pin: Joi.string().length(4).pattern(/^\d{4}$/).required()
    .messages({ 'string.pattern.base': 'PIN must be exactly 4 digits.' }),
});

const loginSchema = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const checkUsernameSchema = Joi.object({
  username: Joi.string().trim().min(3).max(64).required(),
});

const resetPasswordByPinSchema = Joi.object({
  username: Joi.string().trim().required(),
  pin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
  newPassword: Joi.string().min(10).max(128).required(),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords do not match.' }),
});

const forgotPinSchema = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required(),
  newPin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
  confirmPin: Joi.any().valid(Joi.ref('newPin')).required()
    .messages({ 'any.only': 'PINs do not match.' }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(10).max(128).required(),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords do not match.' }),
});

const changePinSchema = Joi.object({
  currentPin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
  newPin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
  confirmPin: Joi.any().valid(Joi.ref('newPin')).required()
    .messages({ 'any.only': 'PINs do not match.' }),
});

const updateProfileSchema = Joi.object({
  fullName: Joi.string().trim().max(128).allow('', null),
  phone: Joi.string().trim().pattern(PK_PHONE_RE)
    .messages({ 'string.pattern.base': 'Phone must be in the format 03XX-XXXXXXX.' }),
}).min(1);

const createTransactionSchema = Joi.object({
  kind: Joi.string().valid('transaction', 'donation').required(),
  bankType: Joi.string().valid('SparrowPay', 'SadaPay', 'JazzCash').required(),
  to: Joi.string().trim().min(1).max(128).required(),
  amount: Joi.number().positive().precision(2).required(),
  pin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
});

const favoriteSchema = Joi.object({
  name: Joi.string().trim().min(1).max(128).required(),
  accountType: Joi.string().valid('SparrowPay', 'SadaPay', 'JazzCash').required(),
});

const favoriteCheckSchema = Joi.object({
  name: Joi.string().trim().min(1).max(128).required(),
  accountType: Joi.string().valid('SparrowPay', 'SadaPay', 'JazzCash').required(),
});

const donationMintSchema = Joi.object({
  blindedSerials: Joi.array()
    .items(Joi.string().min(1).max(2048))
    .min(1)
    .max(200)
    .required(),
  amount: Joi.number().integer().min(1).max(200).required(),
  pin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
});

const donationRedeemSchema = Joi.object({
  recipient: Joi.string().trim().min(1).max(64).required(),
  tokens: Joi.array()
    .items(Joi.object({
      serial: Joi.string().hex().length(64).required(),
      sig: Joi.string().min(1).max(2048).required(),
    }))
    .min(1)
    .max(200)
    .required(),
});

// ---------- Middleware factory ----------

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const data = source === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
      const msg = error.details.map((d) => d.message).join(' ');
      return next(new BadRequestError(msg));
    }
    if (source === 'query') req.query = value;
    else req.body = value;
    return next();
  };
}

module.exports = {
  PK_PHONE_RE,
  PK_CNIC_RE,
  schemas: {
    signupSchema,
    loginSchema,
    refreshSchema,
    checkUsernameSchema,
    resetPasswordByPinSchema,
    forgotPinSchema,
    changePasswordSchema,
    changePinSchema,
    updateProfileSchema,
    createTransactionSchema,
    favoriteSchema,
    favoriteCheckSchema,
    donationMintSchema,
    donationRedeemSchema,
  },
  validate,
};
