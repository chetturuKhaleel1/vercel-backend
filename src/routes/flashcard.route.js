import { Router } from "express";
import { getFlashcards } from "../controllers/flashcard.controller.js";

const router = Router();

router.get("/:jobId", getFlashcards);

export default router;
