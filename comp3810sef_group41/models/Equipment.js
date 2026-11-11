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
equipmentSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Equipment', equipmentSchema);
