import mongoose from "mongoose";

const scanHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  scanId: {
    type: String,
    required: true,
    unique: true,
    default: () =>
      `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  imageName: {
    type: String,
    default: "food-scan.jpg",
  },
  detectedItems: [
    {
      food: String,
      matchedItem: String,
      category: String,
      subCategory: String,
      grams: Number,
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      source: String,
      confidence: Number,
    },
  ],
  totals: {
    calories: {
      type: Number,
      default: 0,
    },
    protein: {
      type: Number,
      default: 0,
    },
    carbs: {
      type: Number,
      default: 0,
    },
    fat: {
      type: Number,
      default: 0,
    },
  },
  addedToDailyIntake: {
    type: Boolean,
    default: false,
  },
  intakeDate: Date,
  metadata: {
    deviceType: String,

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

scanHistorySchema.index({ userId: 1, createdAt: -1 });
scanHistorySchema.index({ userId: 1, addedToDailyIntake: 1 });

scanHistorySchema.index({ "metadata.location": "2dsphere" });

scanHistorySchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  if (
    this.detectedItems &&
    this.detectedItems.length > 0 &&
    !this.totals.calories
  ) {
    this.totals = {
      calories: Math.round(
        this.detectedItems.reduce((sum, item) => sum + (item.calories || 0), 0),
      ),
      protein:
        Math.round(
          this.detectedItems.reduce(
            (sum, item) => sum + (item.protein || 0),
            0,
          ) * 10,
        ) / 10,
      carbs:
        Math.round(
          this.detectedItems.reduce((sum, item) => sum + (item.carbs || 0), 0) *
            10,
        ) / 10,
      fat:
        Math.round(
          this.detectedItems.reduce((sum, item) => sum + (item.fat || 0), 0) *
            10,
        ) / 10,
    };
  }
});

const ScanHistory = mongoose.model("ScanHistory", scanHistorySchema);

export default ScanHistory;
