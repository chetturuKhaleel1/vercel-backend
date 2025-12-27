import Job from "../models/job.model.js";
import { runJob } from "../services/video.service.js";
import { extractFrames } from "../services/frameExtractor.service.js";
import { buildCleanSlidesPDF } from "../services/slideBuilder.service.js";

const queue = [];
let running = false;

export function enqueueJob(jobId) {
  queue.push(jobId);
  processQueue();
}

async function processQueue() {
  if (running) return;
  running = true;

  while (queue.length > 0) {
    const jobId = queue.shift();

    try {
      console.log("▶ Processing job", jobId);

      // FETCH JOB FROM DB
      const job = await Job.findOne({ jobId });
      if (!job) throw new Error("Job not found");

      // Mark job as processing
      job.status = "processing";
      job.progress = 5;
      await job.save();

      // STEP 1 — Run the full video processing pipeline
      await runJob(jobId);

      // STEP 4 — Mark job as DONE
      job.status = "done";
      job.progress = 100;
      await job.save();

      console.log("✅ Job done", jobId);

    } catch (err) {
      console.error("❌ Job failed", jobId, err);

      await Job.updateOne(
        { jobId },
        { status: "failed", error: err.message }
      );
    }
  }

  running = false;
}

export default {
  start: () => {
    console.log("Job manager ready");
    processQueue();
  },
  enqueueJob,
};
