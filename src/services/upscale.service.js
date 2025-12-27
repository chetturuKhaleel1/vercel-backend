import path from 'path';
import fs from 'fs';
import { Worker } from 'worker_threads';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

import { UPLOAD_DIR } from '../utils/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jobs = {};

const PROCESSED_DIR = path.join(UPLOAD_DIR, 'processed');
const WORKER_PATH = path.join(__dirname, '../workers/upscaleWorker.js');

if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

export const createUpscaleJob = async (filePath, type = 'video') => {
    const jobId = uuidv4();
    jobs[jobId] = {
        id: jobId,
        status: 'pending',
        progress: 0,
        type,
        inputPath: filePath,
        createdAt: new Date(),
    };

    if (type === 'video') {
        processVideo(jobId, filePath);
    } else {
        processImage(jobId, filePath);
    }

    return jobId;
};

export const getJobStatus = (jobId) => {
    return jobs[jobId];
};

const processVideo = async (jobId, inputPath) => {
    jobs[jobId].status = 'processing';

    try {
        const chunksDir = path.join(UPLOAD_DIR, `chunks_${jobId}`);
        if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions(['-f segment', '-segment_time 3', '-reset_timestamps 1', '-c copy'])
                .output(path.join(chunksDir, 'chunk_%03d.mp4'))
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        const chunkFiles = fs.readdirSync(chunksDir).map(f => path.join(chunksDir, f));
        const totalChunks = chunkFiles.length;
        let completedChunks = 0;
        const processedChunks = new Array(totalChunks);

        const workerPromises = chunkFiles.map((chunkPath, index) => {
            return new Promise((resolve, reject) => {
                const worker = new Worker(WORKER_PATH, {
                    workerData: {
                        chunkPath,
                        outputPath: path.join(chunksDir, `processed_${index}.mp4`),
                        modelPath: path.join(__dirname, '../../models/realesrgan-x4.onnx')
                    }
                });

                worker.on('message', (msg) => {
                    if (msg.status === 'done') {
                        processedChunks[index] = msg.outputFile;
                        completedChunks++;
                        jobs[jobId].progress = Math.round((completedChunks / totalChunks) * 100);
                        resolve();
                    } else if (msg.status === 'error') {
                        reject(new Error(msg.error));
                    }
                });

                worker.on('error', reject);
                worker.on('exit', (code) => {
                    if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
        });

        await Promise.all(workerPromises);

        jobs[jobId].status = 'stitching';
        const finalOutputPath = path.join(PROCESSED_DIR, `upscaled_${jobId}.mp4`);

        const listPath = path.join(chunksDir, 'list.txt');
        const fileContent = processedChunks.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(listPath, fileContent);

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(listPath)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions('-c copy')
                .output(finalOutputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        jobs[jobId].status = 'completed';
        jobs[jobId].outputUrl = `/uploads/processed/upscaled_${jobId}.mp4`;
        fs.rmSync(chunksDir, { recursive: true, force: true });

    } catch (error) {
        console.error('Upscale error:', error);
        jobs[jobId].status = 'failed';
        jobs[jobId].error = error.message;
    }
};

const processImage = async (jobId, inputPath) => {
    jobs[jobId].status = 'processing';

    try {
        const sharp = (await import('sharp')).default;
        const outputPath = path.join(PROCESSED_DIR, `upscaled_${jobId}.png`);
        const modelPath = path.join(__dirname, '../../models/realesrgan-x4.onnx');
        const modelExists = fs.existsSync(modelPath);

        // For now, just use Sharp fallback since ONNXRuntime isn't installing
        console.log(modelExists ? 'Model found but using Sharp (ONNX not installed)' : 'Model not found');

        const metadata = await sharp(inputPath).metadata();
        const width = metadata.width;
        const height = metadata.height;

        let targetWidth, targetHeight;
        if (width >= height) {
            targetWidth = 3840;
            targetHeight = Math.round(height * (3840 / width));
        } else {
            targetHeight = 3840;
            targetWidth = Math.round(width * (3840 / height));
        }

        await sharp(inputPath)
            .sharpen({ sigma: 1.0, m1: 0, m2: 0, x1: 0, y2: 0, y3: 0 })
            .resize({ width: targetWidth, height: targetHeight, kernel: 'lanczos3', fastShrinkOnLoad: false })
            .sharpen({ sigma: 3.0, m1: 0, m2: 0, x1: 0, y2: 0, y3: 0 })
            .modulate({ brightness: 1.05, saturation: 1.3, lightness: 1.0 })
            .png({ quality: 100, compressionLevel: 6 })
            .toFile(outputPath);

        jobs[jobId].status = 'completed';
        jobs[jobId].progress = 100;
        jobs[jobId].outputUrl = `/uploads/processed/upscaled_${jobId}.png`;

    } catch (error) {
        console.error('Image upscale error:', error);
        jobs[jobId].status = 'failed';
        jobs[jobId].error = error.message;
    }
};
