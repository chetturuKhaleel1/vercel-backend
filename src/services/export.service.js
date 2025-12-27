import ffmpeg from "fluent-ffmpeg";
import fs from "fs";

/* --------------------------------------------------------------
   AUTO KEYWORD HIGHLIGHT (No emojis)
-------------------------------------------------------------- */
const KEYWORDS = [
    "money", "cash", "dollar", "business", "client", "sales", "sell", "marketing",
    "viral", "growth", "views", "blow", "explode", "boost",
    "ai", "model", "prompt", "automation", "script", "tool",
    "story", "learn", "tip", "secret", "hack", "trick",
    "problem", "fix", "solution", "fast", "quick", "speed",
    "power", "strong", "high", "best", "top", "win", "master"
];

const KEYWORD_COLOR = "&H006BFF&"; // orange/blue tone


/* --------------------------------------------------------------
   PRE-PROCESSOR — remove echoes, duplicates, overlaps
-------------------------------------------------------------- */
function normalizeCaptions(words) {
    words = words.filter(w => !w.confidence || w.confidence > 0.35);
    words = words.sort((a, b) => a.start - b.start);

    const merged = [];
    for (let w of words) {
        const last = merged[merged.length - 1];
        if (last && w.word === last.word && w.start < last.end + 0.12) {
            last.end = Math.max(last.end, w.end);
        } else merged.push(w);
    }
    words = merged;

    const clean = [];
    for (let w of words) {
        const last = clean[clean.length - 1];
        if (!last) clean.push(w);
        else {
            const same = last.word.toLowerCase() === w.word.toLowerCase();
            const tooClose = w.start - last.end < 0.20;
            if (same && tooClose) continue;
            clean.push(w);
        }
    }
    words = clean;

    for (let i = 0; i < words.length - 1; i++) {
        const a = words[i];
        const b = words[i + 1];

        if (a.end >= b.start) a.end = b.start - 0.01;
        if (a.end <= a.start) a.end = a.start + 0.05;
    }
    return words;
}


/* --------------------------------------------------------------
   EXPORT FUNCTION
-------------------------------------------------------------- */
export async function exportWithCaptions(videoPath, exportData, outputPath, onProgress) {
    return new Promise((resolve, reject) => {
        try {
            const { words, style, fontSize, yPos, textColor } = exportData;

            const normalized = normalizeCaptions(words);

            const cleanWords = normalized.filter(w => {
                const t = w.word.trim().toLowerCase().replace(/[.,!?]/g, "");
                if (w.word.startsWith("[") && w.word.endsWith("]")) return false;
                if (w.word.startsWith("(") && w.word.endsWith(")")) return false;
                if (w.word.includes("*")) return false;
                if (["um", "uh", "ah", "hmm"].includes(t)) return false;
                return true;
            });

            const chunks = [];
            for (let i = 0; i < cleanWords.length; i += 3) {
                const part = cleanWords.slice(i, i + 3);
                chunks.push({
                    words: part,
                    start: part[0].start,
                    end: part[part.length - 1].end
                });
            }

            const assPath = outputPath.replace(".mp4", ".ass");
            fs.writeFileSync(assPath, generateASS(chunks, style, fontSize, yPos, textColor), "utf8");

            const escaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");

            ffmpeg(videoPath)
                .outputOptions([
                    `-vf subtitles='${escaped}'`,
                    "-c:a copy",
                    "-c:v libx264",
                    "-preset slow",
                    "-crf 16",
                    "-r 60",
                    "-movflags +faststart",
                    "-pix_fmt yuv420p"
                ])
                .output(outputPath)
                .on("progress", (p) => {
                    if (p.percent) onProgress(Math.min(100, Math.round(p.percent)));
                })
                .on("end", () => {
                    if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
                    resolve(outputPath);
                })
                .on("error", err => {
                    if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
                    reject(err);
                })
                .run();

        } catch (err) {
            reject(err);
        }
    });
}


/* --------------------------------------------------------------
   ASS GENERATOR — POP + keyword highlight + stable chunk
-------------------------------------------------------------- */
/* --------------------------------------------------------------
   ASS GENERATOR — POP + keyword highlight + stable chunk
-------------------------------------------------------------- */
function generateASS(chunks, styleName, fontSize, yPos, customColor) {
    const config = getStyle(styleName, customColor);

    const W = 1080;
    const H = 1920;
    const marginTop = Math.round(H * (yPos / 100));
    const scaledFont = Math.round(fontSize * 3);

    let out = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${config.fontName},${scaledFont},${toA(config.primaryColor)},${toA(config.secondaryColor)},${toA(config.outlineColor)},${toA(config.backColor)},${config.bold},${config.italic},0,0,100,100,0,0,1,${config.outlineWidth},${config.shadowDepth},8,10,10,${marginTop},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    chunks.forEach(chunk => {
        let currentTime = chunk.start;

        chunk.words.forEach((activeWord, idx) => {
            // 1. GAP before this word? (If gap > 0.01s)
            if (activeWord.start > currentTime + 0.01) {
                out += createEventLine(chunk.words, -1, currentTime, activeWord.start, config, styleName);
            }

            // 2. ACTIVE event for this word
            // Ensure we don't go back in time if overlaps exist (though normalizeCaptions handles this)
            const start = Math.max(currentTime, activeWord.start);
            const end = activeWord.end;

            if (end > start) {
                out += createEventLine(chunk.words, idx, start, end, config, styleName);
            }

            currentTime = Math.max(currentTime, end);
        });

        // 3. GAP after last word? (Only if chunk explicitly ends later)
        if (currentTime < chunk.end - 0.01) {
            out += createEventLine(chunk.words, -1, currentTime, chunk.end, config, styleName);
        }
    });

    return out;
}

function createEventLine(words, activeIdx, start, end, config, styleName) {
    const startTime = ts(start);
    const endTime = ts(end);
    let line = "";

    words.forEach((w, idx) => {
        const text = w.word;
        const lower = text.toLowerCase().replace(/[.,!?]/g, "");
        const isKeyword = KEYWORDS.includes(lower);
        const isActive = idx === activeIdx;

        // ANIMATION LOGIC
        const isHormozi = styleName === "hormozi";
        const scale = isHormozi ? 115 : 105;
        const rot = isHormozi ? "\\frz-2" : "";
        const resetRot = isHormozi ? "\\frz0" : "";

        if (isActive) {
            // ACTIVE WORD POP
            line += `{\\c${config.highlightColor}\\b1\\bord6\\fscx${scale}\\fscy${scale}${rot}}${text}{\\fscx100\\fscy100\\bord${config.outlineWidth}\\b0\\c${config.primaryColor}${resetRot}} `;
        }
        else if (isKeyword) {
            line += `{\\c${KEYWORD_COLOR}}${text}{\\c${config.primaryColor}} `;
        }
        else {
            line += `${text} `;
        }
    });

    return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${line.trim()}\n`;
}


/* --------------------------------------------------------------
   STYLE CONFIG — all stable except POP
-------------------------------------------------------------- */

function getStyle(style, customColor) {
    const WHITE = "&HFFFFFF&";
    const BLACK = "&H000000&";
    const YELLOW = "&H00FFFF&";

    const mainColor = customColor ? hexToASS(customColor) : YELLOW;

    // Default Base: Hormozi-like (White text, Colored highlight)
    const base = {
        fontName: "Arial Black",
        primaryColor: WHITE,          // Default to White
        secondaryColor: BLACK,
        outlineColor: BLACK,
        backColor: "&H80000000&",
        bold: -1,
        italic: 0,
        outlineWidth: 3,
        shadowDepth: 2,
        highlightColor: mainColor,    // Highlight is Custom Color
    };

    switch (style) {
        case "hormozi":
            return { ...base, shadowDepth: 5, italic: -1 };

        case "beast":
            // Client: Custom Color
            return { ...base, primaryColor: mainColor, outlineWidth: 4, shadowDepth: 4 };

        case "devin":
            // Client: Custom Color, Sans Bold
            return { ...base, primaryColor: mainColor, fontName: "Arial", bold: -1, shadowDepth: 2 };

        case "neon":
            // Client: Custom Color, Glow
            return { ...base, primaryColor: mainColor, fontName: "Courier New", outlineColor: mainColor, outlineWidth: 3, shadowDepth: 0 };

        case "glitch":
            // Client: Custom Color
            return { ...base, primaryColor: mainColor, fontName: "Courier New", outlineWidth: 2 };

        case "minimal":
            // Client: Custom Color, Box
            return { ...base, primaryColor: mainColor, fontName: "Arial", outlineWidth: 0, backColor: "&HFF000000&", shadowDepth: 0 };

        case "gradient":
            // Client: Gradient (Approx with Pink/Purple for now as ASS doesn't support gradients easily)
            return { ...base, primaryColor: "&HFF00FF&", highlightColor: "&HFF00FF&" };

        case "fire":
            // Client: Custom Color (usually Orange/Red)
            return { ...base, primaryColor: mainColor, outlineColor: "&H0000FF&" };

        case "ice":
            // Client: Custom Color (Cyan)
            return { ...base, primaryColor: mainColor, outlineColor: "&HFF0000&" };

        case "gold":
            // Client: Custom Color (Gold)
            return { ...base, primaryColor: mainColor, shadowDepth: 3 };

        case "retro":
            // Client: Custom Color (Pink), Pink Shadow
            return { ...base, primaryColor: mainColor, shadowDepth: 4, outlineColor: BLACK };

        default:
            // For any other style, assume Custom Color for text
            return { ...base, primaryColor: mainColor };
    }
}

function toA(c) { return c.replace("&H", "&H00"); }
function pad(n) { return String(n).padStart(2, "0"); }
function ts(t) {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const cs = Math.floor((t % 1) * 100);
    return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}
function hexToASS(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `&H${pad(b.toString(16).toUpperCase())}${pad(g.toString(16).toUpperCase())}${pad(r.toString(16).toUpperCase())}&`;
}
