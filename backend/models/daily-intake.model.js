import mongoose from "mongoose";

const foodItemSchema = new mongoose.Schema({
  foodName: {
    type: String,
    required: true,
  },
  matchedItem: String,
  category: String,
  subCategory: String,
  grams: {
    type: Number,
    required: true,
    min: 0,
  },
  calories: {
    type: Number,
    required: true,
    min: 0,
  },
  protein: {
    type: Number,
    required: true,
    min: 0,
  },
  carbs: {
    type: Number,
    required: true,
    min: 0,
  },
  fat: {
    type: Number,
    required: true,
    min: 0,
  },
  imageUrl: String,
  source: {
    type: String,
    enum: ["database", "detected_only", "manual"],
    default: "detected_only",
  },
});

const dailyIntakeSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  items: [foodItemSchema],
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

dailyIntakeSchema.index({ userId: 1, date: 1 }, { unique: true });

dailyIntakeSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  if (this.items && this.items.length > 0) {
    this.totals = {
      calories: Math.round(
        this.items.reduce((sum, item) => sum + (item.calories || 0), 0),
      ),
      protein:
        Math.round(
          this.items.reduce((sum, item) => sum + (item.protein || 0), 0) * 10,
        ) / 10,
      carbs:
        Math.round(
          this.items.reduce((sum, item) => sum + (item.carbs || 0), 0) * 10,
        ) / 10,
      fat:
        Math.round(
          this.items.reduce((sum, item) => sum + (item.fat || 0), 0) * 10,
        ) / 10,
    };
  }
});

const DailyIntake = mongoose.model("DailyIntake", dailyIntakeSchema);

export default DailyIntake;
