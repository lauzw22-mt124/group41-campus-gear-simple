/**
 * Administrator account.
 * `passwordHash` is `select: false`, so it is never returned by ordinary
 * queries; login explicitly selects it for the bcrypt comparison.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
