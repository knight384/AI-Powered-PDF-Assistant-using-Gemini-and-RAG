# 🚀 AI PDF Assistant using Gemini (RAG + Semantic Search)

An intelligent PDF chatbot that allows users to upload documents and ask questions with context-aware answers powered by **Google Gemini AI**.
The system uses **Retrieval-Augmented Generation (RAG)** with **semantic search, embeddings, and chat memory** to deliver accurate and relevant responses.

---

## 🧠 Features

* 📄 **Upload & Parse**: Process PDF documents instantly.
* 💬 **AI Chat**: Ask questions about your document context.
* 🔍 **Semantic Search**: Uses embeddings for precise context retrieval (powered by `text-embedding-004`).
* 🧩 **Smart Chunking**: Automatically breaks down large documents for optimal processing.
* 🧠 **Conversational Memory**: Remembers your previous questions for natural follow-ups.
* 📚 **Source Citation**: Transparently see which parts of the document contributed to an answer.
* ⚡ **Fast Responses**: Optimized RAG pipeline for real-time interaction.
* 🎯 **Context-Aware**: Driven by Gemini 1.5 Flash for high-quality reasoning.

---

## 🏗️ Architecture

```
PDF → Text Extraction (Backend) → Client-side Coordination
User Question → Backend Embedding → Similarity Search → Context Retrieval → Gemini → Answer
```

---

## 🛠️ Tech Stack

**Frontend**
* **Framework**: Vanilla JavaScript (Modern ES6+)
* **Styling**: Tailwind CSS

**Backend**
* **Runtime**: Node.js (Express)
* **Language**: TypeScript

**AI / ML**
* **Generation**: Google Gemini API (`gemini-3-flash-preview`)
* **Embeddings**: `gemini-embedding-2-preview` (via Google GenAI SDK)

**Libraries**
* `pdf-parse`: High-performance PDF text extraction
* `multer`: Secure file upload handling
* `cors`: Cross-Origin Resource Sharing

---

## 📂 Project Structure

```
/project-root
  ├── server.ts          # Express backend (API routes, RAG logic)
  ├── package.json       # Dependencies and scripts
  ├── .env.example       # Environment template
  ├── src/               # Frontend source
  │   ├── main.js        # Chat logic and UI management
  │   └── index.css      # global styles
  └── index.html         # Main application UI
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the repository
```bash
git clone <your-repo-url>
cd project
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Environment Configuration
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_api_key_here
```

### 4️⃣ Run the Application
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

---

## 📡 API Endpoints

### `POST /api/upload`
* **Purpose**: Extracts text from a PDF file.
* **Payload**: `multipart/form-data` with `pdf` file field.

### `POST /api/chat`
* **Purpose**: Performs RAG and generates an AI answer.
* **Payload**:
  ```json
  {
    "question": "What is the key takeaway?",
    "history": []
  }
  ```

### `POST /api/summarize`
* **Purpose**: Generates a professional summary of the current document.

---

## 🧠 Key Concepts Used

* **RAG (Retrieval-Augmented Generation)**: Supplying external data (PDF content) to the LLM at inference time.
* **Semantic Search**: Matching the *meaning* of a question to document segments using vector math.
* **Cosine Similarity**: The mathematical algorithm used to rank the relevance of text chunks.
* **Context Injection**: Dynamically building prompts that contain only the necessary data to answer a query.

---

## 👨‍💻 Project Highlights
* **Zero Abstraction**: Built the RAG pipeline from scratch without heavy frameworks like LangChain to maintain maximum performance and control.
* **Hybrid Storage**: Efficient in-memory vector handling for session-based document analysis.
* **Streamlined UI**: A clean, sidebar-driven interface designed for productivity.

---

## ⭐ Support
If you find this project useful, give it a ⭐ on GitHub!

---
**Author**: [Your Name/Anish Choudhury]
**GitHub**: [https://github.com/anishchoudhury624](https://github.com/anishchoudhury624)
