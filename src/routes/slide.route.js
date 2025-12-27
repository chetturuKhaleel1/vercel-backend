// server/src/routes/slide.route.js
import express from "express";
import { generateSlidesFromVideo } from "../controllers/slide.controller.js";

const router = express.Router();

router.post("/generate", generateSlidesFromVideo);

export default router;
