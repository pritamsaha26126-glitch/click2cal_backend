import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    default: () => {
      const adjectives = [
        "Hungry",
        "Foodie",
        "Healthy",
        "Fit",
        "Happy",
        "Active",
        "Strong",
        "Energetic",
      ];
      const nouns = [
        "Panda",
        "Tiger",
        "Lion",
        "Bear",
        "Wolf",
        "Eagle",
        "Shark",
        "Dragon",
      ];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      return `${adj}${noun}${Math.floor(Math.random() * 1000)}`;
    },
  },
  avatar: {
    type: String,
    default: () => {
      const avatars = [
        "https://api.dicebear.com/7.x/avataaars/svg?seed=",
        "https://api.dicebear.com/7.x/big-ears/svg?seed=",
        "https://api.dicebear.com/7.x/micah/svg?seed=",
      ];
      const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
      const randomSeed = Math.random().toString(36).substring(7);
      return `${randomAvatar}${randomSeed}`;
    },
  },

  height: {
    type: Number,
    min: 50,
    max: 250,
  },
  weight: {
    type: Number,
    min: 20,
    max: 300,
  },
  age: {
    type: Number,
    min: 13,
    max: 120,
  },
  gender: {
    type: String,
    enum: ["male", "female", "other", "prefer-not-to-say"],
    default: "prefer-not-to-say",
  },

  goal: {
    type: String,
    enum: ["maintain", "gain", "cut", "bulk", "shred"],
    default: "maintain",
  },
  activityLevel: {
    type: String,
    enum: ["sedentary", "light", "moderate", "active", "very-active"],
    default: "moderate",
  },

  dailyCalories: {
    type: Number,
    default: 2000,
  },
  dailyProtein: {
    type: Number,
    default: 0,
  },
  dailyCarbs: {
    type: Number,
    default: 0,
  },
  dailyFat: {
    type: Number,
    default: 0,
  },
  expoPushToken: {
    type: String,
    default: null,
  },

  pushEnabled: {
    type: Boolean,
    default: true,
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

userProfileSchema.pre("save", function () {
  console.log("Mongoose pre-save hook called");

  this.updatedAt = Date.now();

  if (
    this.height &&
    this.weight &&
    this.age &&
    this.gender &&
    this.activityLevel &&
    this.goal
  ) {
    console.log("Calculating nutrition needs...");
    this.calculateNutritionNeeds();
  }
});
userProfileSchema.methods.calculateNutritionNeeds = function () {
  let bmr;
  if (this.gender === "male") {
    bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age + 5;
  } else if (this.gender === "female") {
    bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age - 161;
  } else {
    bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age - 78;
  }

  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    "very-active": 1.9,
  };

  let tdee = bmr * (activityMultipliers[this.activityLevel] || 1.55);

  const goalAdjustments = {
    maintain: 1,
    gain: 1.15,
    bulk: 1.2,
    cut: 0.85,
    shred: 0.8,
  };

  tdee = tdee * (goalAdjustments[this.goal] || 1);

  const proteinPerKg = this.goal === "cut" || this.goal === "shred" ? 2.2 : 1.8;
  const proteinGrams = Math.round(this.weight * proteinPerKg);
  const proteinCalories = proteinGrams * 4;

  let fatPercentage = 0.25;
  const fatCalories = tdee * fatPercentage;
  const fatGrams = Math.round(fatCalories / 9);

  const remainingCalories = tdee - proteinCalories - fatCalories;
  const carbGrams = Math.round(remainingCalories / 4);

  this.dailyCalories = Math.round(tdee);
  this.dailyProtein = proteinGrams;
  this.dailyCarbs = carbGrams;
  this.dailyFat = fatGrams;

  return {
    calories: this.dailyCalories,
    protein: this.dailyProtein,
    carbs: this.dailyCarbs,
    fat: this.dailyFat,
  };
};

userProfileSchema.methods.getProgress = function () {
  const today = new Date().toISOString().split("T")[0];

  return {
    date: today,
    target: {
      calories: this.dailyCalories,
      protein: this.dailyProtein,
      carbs: this.dailyCarbs,
      fat: this.dailyFat,
    },
    remaining: {
      calories: this.dailyCalories,
      protein: this.dailyProtein,
      carbs: this.dailyCarbs,
      fat: this.dailyFat,
    },
  };
};

const UserProfile = mongoose.model("UserProfile", userProfileSchema);

export default UserProfile;
