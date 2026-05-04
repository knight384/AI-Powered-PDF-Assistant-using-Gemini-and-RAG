import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse");
let pdfFunc = pdfModule;
if (typeof pdfFunc !== 'function' && pdfModule.default) {
  pdfFunc = pdfModule.default;
}
const pdf = pdfFunc;
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
    console.warn("GEMINI_API_KEY not found in environment");
  }
  const ai = new GoogleGenAI({ apiKey: apiKey || "" });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // RAG Storage
  let storedFullText = "";
  let storedChunks: string[] = [];
  let storedEmbeddings: { text: string; embedding: number[] }[] = [];
  let totalChunks = 0;

  // Chat History Memory
  let chatHistory: { role: "user" | "assistant"; content: string }[] = [];

  function trimHistory() {
    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(-10);
    }
  }

  function cosineSimilarity(a: number[], b: number[]) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  function tokenize(text: string): string[] {
    const stopWords = new Set(["a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "from", "by", "for", "with", "in", "on", "to", "is", "was", "are", "were", "what", "how", "why", "can", "could", "would", "should"]);
    return text.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(token => token.length > 2 && !stopWords.has(token));
  }

  function chunkText(text: string, size = 3000) {
    const chunks = [];
    // Ensure we don't create too many chunks
    const dynamicSize = Math.max(size, Math.floor(text.length / 50));
    for (let i = 0; i < text.length; i += dynamicSize) {
      const chunk = text.slice(i, i + dynamicSize).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  async function getRelevantChunks(question: string) {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: question,
    });
    const queryEmbedding = response.embeddings[0].values;

    const scored = storedEmbeddings.map(item => ({
      text: item.text,
      score: cosineSimilarity(item.embedding, queryEmbedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  // Set up multer for file uploads with limits
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Upload endpoint
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
      console.log("Starting PDF processing", req.file ? `File size: ${req.file.size}` : "No file");
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      if (typeof pdf !== 'function') {
        console.error("PDF parser is not a function:", typeof pdf);
        return res.status(500).json({ error: "PDF parser initialization failed" });
      }

      const data = await pdf(req.file.buffer);
      console.log("PDF parsed successfully", `Text length: ${data.text?.length}`);
      const text = data.text || "";
      storedFullText = text;
      storedChunks = chunkText(text);
      totalChunks = storedChunks.length;
      
      // Generate embeddings in small parallel batches
      storedEmbeddings = [];
      const concurrencyLimit = 3;
      for (let i = 0; i < storedChunks.length; i += concurrencyLimit) {
        const batch = storedChunks.slice(i, i + concurrencyLimit);
        console.log(`Processing embedding batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(storedChunks.length / concurrencyLimit)}`);
        
        await Promise.all(batch.map(async (chunk) => {
          try {
            const result = await ai.models.embedContent({
              model: "gemini-embedding-2-preview",
              contents: chunk,
            });

            if (result && result.embeddings && result.embeddings[0] && result.embeddings[0].values) {
              storedEmbeddings.push({
                text: chunk,
                embedding: result.embeddings[0].values,
              });
            }
          } catch (embedError) {
            console.error("Single embedding error:", embedError);
          }
        }));
      }

      console.log(`Successfully indexed ${totalChunks} chunks with embeddings for RAG.`);
      res.json({ message: "PDF uploaded and processed successfully", textLength: text.length });
    } catch (error) {
      console.error("PDF processing error:", error);
      res.status(500).json({ error: "Failed to process PDF" });
    }
  });

  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ error: "Question is required" });
      }
      if (!storedEmbeddings.length) {
        return res.status(400).json({ error: "No PDF context available. Please upload a PDF first." });
      }

      // Add user question to history
      chatHistory.push({ role: "user", content: question });

      const relevantChunks = await getRelevantChunks(question);

      if (relevantChunks.length === 0) {
        return res.json({
          answer: "No relevant information found in document."
        });
      }

      const context = relevantChunks.map(item => item.text).join("\n");
      const historyText = chatHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join("\n");

      const prompt = `
You are an AI assistant.

Answer ONLY from the context below.

Context:
${context}

History:
${historyText}

Question:
${question}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Alias for small fast model
        contents: prompt,
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      const answer = response.text;
      
      // Stream the answer
      for (let i = 0; i < answer.length; i++) {
        res.write(answer[i]);
        // Small delay for psychological streaming effect as requested
        if (i % 3 === 0) await new Promise(r => setTimeout(r, 1));
      }

      // Append metadata
      const sourcesData = relevantChunks.map((chunk, index) => ({
        id: index + 1,
        preview: chunk.text.slice(0, 150) + "...",
        score: chunk.score.toFixed(2),
      }));

      res.write("\n__SOURCES_JSON__" + JSON.stringify(sourcesData));
      
      // Add assistant response to history
      chatHistory.push({ role: "assistant", content: answer });
      trimHistory();

      res.end();
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to generate AI response" });
    }
  });

  // Summarize endpoint
  app.post("/api/summarize", async (req, res) => {
    try {
      if (!storedFullText) {
        return res.status(400).json({ error: "No PDF context available. Please upload a PDF first." });
      }

      const prompt = `
You are an expert editor. Please provide a concise, professional summary of the following document. 
Focus on the main themes, key takeaways, and overall purpose.
Keep it under 300 words.

Document Content:
${storedFullText.slice(0, 15000)}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      res.json({ summary: response.text });
    } catch (error) {
      console.error("Summarization error:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      embeddingsLoaded: storedEmbeddings.length,
      historySize: chatHistory.length 
    });
  });

  // Reset chat history endpoint
  app.post("/api/reset", (req, res) => {
    chatHistory = [];
    res.json({ message: "Chat history cleared" });
  });

  // Global Error Handler to ensure JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack
    });
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
