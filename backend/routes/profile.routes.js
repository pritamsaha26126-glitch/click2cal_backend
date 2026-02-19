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
router.put("/nutrition-goals", updateNutritionGoals);
router.put("/avatar", uploadAvatar);
router.delete("/delete-profile", deleteProfile);

export default router;
