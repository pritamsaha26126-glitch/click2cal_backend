import express from "express";
import {
  createOrUpdateProfile,
  deleteProfile,
  getProfile,
  updateNutritionGoals,
  uploadAvatar,
} from "../controllers/profile.controller.js";

const router = express.Router();

router.post("/upsert", createOrUpdateProfile);

router.get("/profile", getProfile);
router.put("/profile/nutrition-goals", updateNutritionGoals);
router.put("/profile/avatar", uploadAvatar);
router.delete("/profile/delete-profile", deleteProfile);
export default router;
