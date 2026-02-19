import express from "express";
import cors from "cors";
import foodRoutes from "./routes/food.routes.js";
import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import pushRoutes from "./routes/push.routes.js";
import { connectDB } from "./config/db.js";
// import { uploadCSV } from "./services/upload-csv.js";

const app = express();
connectDB();
// uploadCSV();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/push", pushRoutes);
export default app;
