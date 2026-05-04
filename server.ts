import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY is not set in the environment.");
  }
  const ai = new GoogleGenAI({ apiKey: apiKey || "" });

  // RAG Storage (Simple in-memory for session)
  let storedFullText = "";
  let storedChunks: string[] = [];
  let storedEmbeddings: { text: string; embedding: number[] }[] = [];

  function cosineSimilarity(a: number[], b: number[]) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  function chunkText(text: string, size = 3000) {
    const chunks = [];
    const dynamicSize = Math.max(size, Math.floor(text.length / 50));
    for (let i = 0; i < text.length; i += dynamicSize) {
        const chunk = text.slice(i, i + dynamicSize).trim();
        if (chunk.length > 20) {
            chunks.push(chunk);
        }
    }
    return chunks;
  }

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Set up multer for file uploads with limits
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Upload endpoint: only extracts text from PDF
  app.post("/api/upload", (req, res, next) => {
    console.log("Upload request received");
    upload.single("pdf")(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: "File upload failed: " + err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      let data;
      let parser;
      try {
        parser = new PDFParse({ data: req.file.buffer });
        data = await parser.getText();
      } catch (pdfError: any) {
        console.error("Internal pdf-parse error:", pdfError);
        return res.status(422).json({ 
          error: "PDF structure is invalid or unreadable", 
          details: pdfError.message 
        });
      } finally {
        if (parser) {
          try { await parser.destroy(); } catch (e) { console.error("Error destroying parser:", e); }
        }
      }

      const text = (data.text || "").trim();
      
      if (!text || text.length < 50) {
        return res.status(422).json({ 
          error: "No text found in PDF", 
          details: "This document appears to be empty or contains only images (scanned)." 
        });
      }

      console.log("PDF parsed successfully", `Text length: ${text.length}`);
      
      // Process embeddings on server
      if (!apiKey) {
        return res.status(500).json({ 
          error: "Gemini API Key missing", 
          details: "The server is not configured with a GEMINI_API_KEY. Please ensure it is set in the environment variables via the Settings menu." 
        });
      }

      storedFullText = text;
      storedChunks = chunkText(text);
      storedEmbeddings = [];

      const concurrencyLimit = 3;
      for (let i = 0; i < storedChunks.length; i += concurrencyLimit) {
        const batch = storedChunks.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map(async (chunk) => {
          try {
            const res = await ai.models.embedContent({
              model: "gemini-embedding-2-preview",
              contents: chunk,
            });
            if (res?.embeddings?.[0]?.values) {
              storedEmbeddings.push({
                text: chunk,
                embedding: res.embeddings[0].values,
              });
            }
          } catch (e) {
            console.error("Embedding chunk failed", e);
          }
        }));
      }

      res.json({ text, message: "Document processed and indexed." });
    } catch (error: any) {
      console.error("PDF processing error:", error);
      res.status(500).json({ error: "Failed to process PDF", details: error.message });
    }
  });

  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { question, history } = req.body;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key missing", details: "Please configure GEMINI_API_KEY." });
      }
      if (!storedEmbeddings.length) {
        return res.status(400).json({ error: "No document indexed." });
      }

      // Semantic Search
      const embedResponse = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: question,
      });
      const queryEmbedding = embedResponse.embeddings[0].values;

      const scored = storedEmbeddings.map(item => ({
        text: item.text,
        score: cosineSimilarity(item.embedding, queryEmbedding),
      }));

      const relevantChunks = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const context = relevantChunks.map(item => item.text).join("\n");
      const historyText = (history || [])
        .map((msg: any) => `${msg.sender}: ${msg.text}`)
        .join("\n");

      const prompt = `You are an AI assistant. Answer ONLY from the context below.\n\nContext:\n${context}\n\nHistory:\n${historyText}\n\nQuestion:\n${question}`;

      const response = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      res.setHeader("Content-Type", "text/plain");
      for await (const chunk of response) {
        res.write(chunk.text);
      }
      
      // Send sources at the end
      const sourcesData = relevantChunks.map((chunk, index) => ({
        id: index + 1,
        preview: chunk.text.slice(0, 150) + "...",
        score: chunk.score.toFixed(2),
      }));
      res.write("\n__SOURCES_JSON__" + JSON.stringify(sourcesData));
      res.end();
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to generate AI response", details: error.message });
    }
  });

  // Summarize endpoint
  app.post("/api/summarize", async (req, res) => {
    try {
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key missing", details: "Please configure GEMINI_API_KEY." });
      }
      if (!storedFullText) {
        return res.status(400).json({ error: "No document loaded." });
      }

      const prompt = `Provide a concise summary of this document.\n\nContent:\n${storedFullText.slice(0, 15000)}`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      res.json({ summary: response.text });
    } catch (error: any) {
      console.error("Summary error:", error);
      res.status(500).json({ error: "Failed to generate summary", details: error.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
