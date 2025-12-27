import express from 'express';
import multer from 'multer';
import path from 'path';
import { createUpscaleJob, getJobStatus } from '../services/upscale.service.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'src/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

router.post('/video', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });
        const jobId = await createUpscaleJob(req.file.path, 'video');
        res.json({ jobId, message: 'Video upscale started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
        const jobId = await createUpscaleJob(req.file.path, 'image');
        res.json({ jobId, message: 'Image upscale started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/status/:id', (req, res) => {
    const job = getJobStatus(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

router.get('/download/:jobId', (req, res) => {
    const job = getJobStatus(req.params.jobId);
    if (!job || !job.outputUrl) return res.status(404).send('File not ready or not found');

    // Extract filename from outputUrl
    const filename = path.basename(job.outputUrl);
    const filePath = path.join(path.resolve(), 'src/uploads/processed', filename);

    res.download(filePath, filename); // Set Content-Disposition: attachment
});

export default router;
