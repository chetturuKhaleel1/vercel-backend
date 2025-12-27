import ffmpeg from "fluent-ffmpeg";

export function probe(pathToFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(pathToFile, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
}
