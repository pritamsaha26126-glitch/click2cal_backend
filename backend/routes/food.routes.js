import express from "express";
import multer from "multer";
import {
  analyzeFoodImage,
  addToDailyIntake,
  getDailyIntake,
  getWeeklyProgress,
  getScanHistory,
  getScanById,
  deleteScan,
  getStats,
} from "../controllers/food.controller.js";

const router = express.Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

router.post("/analyze", upload.single("image"), analyzeFoodImage);

router.get("/scan-history", getScanHistory);

router.get("/scan/:scanId", getScanById);

router.delete("/scan/:scanId", deleteScan);

router.post("/scan/add-to-intake", addToDailyIntake);

router.get("/daily-intake", getDailyIntake);

router.get("/weekly-progress", getWeeklyProgress);

router.get("/stats", getStats);

export default router;
