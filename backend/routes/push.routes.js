import express from "express";
import {
  sendNotificationToAll,
  savePushToken,
} from "../controllers/push.controller.js";

const router = express.Router();

router.post("/save-push-token", savePushToken);
router.post("/send-all", sendNotificationToAll);

export default router;
