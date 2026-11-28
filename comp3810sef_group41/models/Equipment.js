/**
 * Physical equipment record. One document represents one individual asset.
 * `assetCode` is the natural key; `status` may only be changed through the
 * service layer (checkout, return, maintenance).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const categories = ['projector', 'microphone', 'tripod'];
const equipmentSchema = new Schema(
  {
    assetCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 32,
    },
    name: { type: String, required: true, maxlength: 120 },
    category: { type: String, enum: categories, required: true },
    location: { type: String, required: true, maxlength: 120 },
    status: {
      type: String,
      enum: ['available', 'borrowed', 'maintenance'],
      default: 'available',
      required: true,
    },
    description: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);
// Supports the category + status filters on the list page and API.
equipmentSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Equipment', equipmentSchema);
