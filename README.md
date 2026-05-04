# 🚀 AI PDF Assistant using Gemini (RAG + Semantic Search)

An intelligent PDF chatbot that allows users to upload documents and ask questions with context-aware answers powered by **Google Gemini AI**.
The system uses **Retrieval-Augmented Generation (RAG)** with **semantic search, embeddings, and chat memory** to deliver accurate and relevant responses.

---

## 🧠 Features

* 📄 Upload and process PDF documents
* 💬 Ask questions about uploaded PDFs
* 🔍 Semantic search using embeddings (no keyword limitations)
* 🧩 Chunking-based document processing
* 🧠 Conversational memory (multi-turn chat)
* 📚 Source citation (see where answers come from)
* ⚡ Streaming responses (real-time typing effect)
* 🎯 Context-aware answers using Gemini AI

---

## 🏗️ Architecture

```
PDF → Text Extraction → Chunking → Embeddings → Storage
User Question → Embedding → Similarity Search → Context Retrieval → Gemini → Answer
```

---

## 🛠️ Tech Stack

**Frontend**

* HTML, CSS, JavaScript

**Backend**

* Node.js (Express)

**AI / ML**

* Google Gemini API (gemini-1.5-flash)
* Embedding model: text-embedding-004

**Libraries**

* multer (file upload)
* pdf-parse (PDF text extraction)
* dotenv (environment variables)

---

## 📂 Project Structure

```
/project
  /backend
    server.js
    .env
    package.json
  /frontend
    index.html
    script.js
    styles.css
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the repository

```
git clone <your-repo-url>
cd project
```

---

### 2️⃣ Setup Backend

```
cd backend
npm install
```

Create `.env` file:

```
GEMINI_API_KEY=your_api_key_here
```

---

### 3️⃣ Run Backend

```
node server.js
```

Server will run at:

```
http://localhost:3001
```

---

### 4️⃣ Run Frontend

Open:

```
frontend/index.html
```

---

## 📡 API Endpoints

### Upload PDF

```
POST /upload
Form-data: file (PDF)
```

---

### Chat with Document

```
POST /chat
{
  "question": "What is this document about?"
}
```

---

### Reset Chat (optional)

```
POST /reset
```

---

## 🔥 Example Response

```
{
  "answer": "The document explains...",
  "sources": [
    {
      "id": 1,
      "preview": "This section describes...",
      "score": "0.92"
    }
  ]
}
```

---

## 🧠 Key Concepts Used

* Retrieval-Augmented Generation (RAG)
* Semantic Search
* Cosine Similarity
* Embeddings
* Context Injection
* Conversational Memory

---

## 🚀 Future Improvements

* 🔗 Vector database (Pinecone / Supabase / FAISS)
* 🌐 Deploy on Vercel / Render
* 🔐 Authentication system
* 📊 Multi-document support
* 🧾 Highlight exact source text in UI

---

## 📌 Project Highlights

* Built a complete AI system without LangChain abstraction
* Implemented custom RAG pipeline from scratch
* Integrated Gemini for both generation and embeddings
* Designed real-time streaming UI for better user experience

---

## 👨‍💻 Author

Anish Choudhary


---

## ⭐ If you like this project

Give it a ⭐ on GitHub and share it!

