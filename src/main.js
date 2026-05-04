// Simple Vanilla JavaScript for AI PDF Chatbot

const pdfUpload = document.getElementById('pdf-upload');
const fileName = document.getElementById('file-name');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const summarizeBtn = document.getElementById('summarize-btn');
const summaryContainer = document.getElementById('summary-container');
const summaryText = document.getElementById('summary-text');

let isUploaded = false;
let chatHistory = [];
let storedFullTextLength = 0;

// Load history on startup
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('pdf_chat_history');
    if (saved) {
        try {
            chatHistory = JSON.parse(saved);
            if (chatHistory.length > 0) {
                // Clear initial assistant message if we have history
                chatMessages.innerHTML = '';
                chatHistory.forEach(msg => {
                    renderMessage(msg.sender, msg.text, msg.type, null, msg.timestamp, msg.sources);
                });
                
                // If there was history, we still need a PDF to continue chatting
                // but we keep the messages visible.
            }
        } catch (e) {
            console.error("Failed to parse history", e);
            chatHistory = [];
        }
    }
});

// Handle Clear History
document.getElementById('clear-history').addEventListener('click', () => {
    localStorage.removeItem('pdf_chat_history');
    chatHistory = [];
    chatMessages.innerHTML = '';
    addMessage('System', 'Chat history has been cleared.', 'system');
});

// Handle file selection
pdfUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = file.name;
    } else {
        fileName.textContent = "Select PDF";
    }
});

// Handle PDF Upload
uploadBtn.addEventListener('click', async () => {
    const file = pdfUpload.files[0];
    if (!file) {
        uploadStatus.textContent = "Please select a file first.";
        uploadStatus.className = "text-center text-xs mt-3 text-red-500";
        return;
    }

    uploadStatus.textContent = "Uploading and processing...";
    uploadStatus.className = "text-center text-xs mt-3 text-zinc-500";
    uploadBtn.disabled = true;

    const formData = new FormData();
    formData.append('pdf', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        let data;
        const responseText = await response.text();
        
        // Detect AI Studio "Cookie check" page
        if (responseText.includes('Cookie check') || responseText.includes('authInSeparateWindowButton')) {
            uploadStatus.innerHTML = `
                <div class="flex flex-col items-center gap-1">
                    <span class="text-amber-600 font-bold">AUTH REQUIRED</span>
                    <p class="text-[9px] text-amber-500 leading-tight">Your browser is blocking cookies. <br/> Open in <span class="font-bold underline">New Tab</span> (top right icon) to fix.</p>
                </div>
            `;
            uploadStatus.className = "text-center mt-3 animate-pulse";
            uploadBtn.disabled = false;
            return;
        }

        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("Non-JSON response received:", responseText);
            throw new Error(`Server returned non-JSON response (${response.status})`);
        }

        if (response.ok) {
            uploadStatus.textContent = "DOCUMENT READY";
            uploadStatus.className = "text-center text-[10px] font-bold mt-3 text-indigo-600 tracking-widest";
            isUploaded = true;
            chatInput.disabled = false;
            chatSend.disabled = false;
            summarizeBtn.disabled = false;
            
            storedFullTextLength = data.text.length;

            // Update Extraction Info
            const extractionInfo = document.getElementById('extraction-info');
            extractionInfo.innerHTML = `
                <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Context Length</span>
                        <span class="text-xs font-mono text-indigo-900">${storedFullTextLength.toLocaleString()} chars</span>
                    </div>
                    <div class="w-full bg-indigo-200 h-1 rounded-full overflow-hidden">
                        <div class="bg-indigo-600 h-full w-full"></div>
                    </div>
                    <p class="text-[10px] text-indigo-600 italic">Document text extracted and indexed on server.</p>
                </div>
            `;

            // Clear initial messages
            chatMessages.innerHTML = '';
            
            addMessage('System', 'The document has been successfully parsed. How can I help you explore it?', 'system');
        } else {
            const errorMsg = data.error || "UPLOAD FAILED";
            const details = data.details ? ` (${data.details})` : "";
            uploadStatus.textContent = errorMsg + details;
            uploadStatus.className = "text-center text-[10px] font-bold mt-3 text-red-500 tracking-widest uppercase";
            uploadBtn.disabled = false;
        }
    } catch (error) {
        console.error('Upload error:', error);
        uploadStatus.textContent = "CONNECTION ERROR";
        uploadStatus.className = "text-center text-[10px] font-bold mt-3 text-red-500 tracking-widest";
        uploadBtn.disabled = false;
    }
});

// Handle Summarize
summarizeBtn.addEventListener('click', async () => {
    if (!isUploaded) return;

    summarizeBtn.disabled = true;
    summarizeBtn.textContent = "Summarizing...";
    
    // Add typing indicator for feedback
    const typingId = 'summary-typing-' + Date.now();
    renderMessage('System', 'Generating document summary...', 'system', typingId);
    
    try {
        const response = await fetch('/api/summarize', {
            method: 'POST'
        });

        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        if (response.ok) {
            const data = await response.json();
            summaryContainer.classList.remove('hidden');
            summaryText.textContent = data.summary;
            summarizeBtn.textContent = "Regenerate Summary";
            addMessage('System', 'The document summary has been generated and displayed in the sidebar.', 'system');
        } else {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Summarization failed");
        }
    } catch (error) {
        console.error('Summary error:', error);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        addMessage('System', 'Error generating summary: ' + (error.message || 'Unknown error'), 'system');
        summarizeBtn.textContent = "Generate Summary";
    } finally {
        summarizeBtn.disabled = false;
    }
});

// Handle Chat Message
chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const question = chatInput.value.trim();
    if (!question || !isUploaded) return;

    // Add user message
    addMessage('You', question, 'user');
    chatInput.value = '';
    
    // Add typing indicator
    const typingId = 'typing-' + Date.now();
    renderMessage('AI', 'Typing...', 'ai', typingId);
    
    chatInput.disabled = true;
    chatSend.disabled = true;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, history: chatHistory })
        });

        if (!response.ok) {
            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            const data = await response.json().catch(() => ({}));
            addMessage('System', "Error: " + (data.error || "Failed to get response."), 'system');
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let cumulativeText = "";
        const typingEl = document.getElementById(typingId);
        const textContainer = typingEl ? typingEl.querySelector('.message-text') : null;
        if (textContainer) textContainer.textContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            cumulativeText += chunk;
            
            // Check for sources separator
            const parts = cumulativeText.split('\n__SOURCES_JSON__');
            const displayText = parts[0];
            
            if (textContainer) {
                textContainer.textContent = displayText;
                scrollToBottom();
            }
        }
        
        // Final parse
        const finalParts = cumulativeText.split('\n__SOURCES_JSON__');
        const finalAnswer = finalParts[0];
        let finalSources = null;
        if (finalParts[1]) {
            try {
                finalSources = JSON.parse(finalParts[1]);
            } catch (e) {
                console.error("Failed to parse sources", e);
            }
        }

        // Cleanup typing indicator and add final message (saves to history)
        if (typingEl) typingEl.remove();
        addMessage('AI', finalAnswer, 'ai', null, null, finalSources);

    } catch (error) {
        console.error('Chat error:', error);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        addMessage('System', "Error: " + (error.message || "Failed to get response."), 'system');
    } finally {
        chatInput.disabled = false;
        chatSend.disabled = false;
        chatInput.focus();
        scrollToBottom();
    }
}

function addMessage(sender, text, type, id = null, timestamp = null, sources = null) {
    const ts = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (!id && type !== 'system') {
        chatHistory.push({ sender, text, type, timestamp: ts, sources });
        localStorage.setItem('pdf_chat_history', JSON.stringify(chatHistory));
    }
    renderMessage(sender, text, type, id, ts, sources);
}

function renderMessage(sender, text, type, id = null, timestamp = null, sources = null) {
    const div = document.createElement('div');
    div.className = `flex gap-4 ${type === 'user' ? 'justify-end' : 'justify-start'}`;
    if (id) div.id = id;

    if (type !== 'user' && type !== 'system') {
        const avatar = document.createElement('div');
        avatar.className = 'w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 border border-indigo-200';
        avatar.innerHTML = `<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
        </svg>`;
        div.appendChild(avatar);
    } else if (type === 'system') {
        const spacer = document.createElement('div');
        spacer.className = 'w-8 h-8 flex-shrink-0';
        div.appendChild(spacer);
    }

    const inner = document.createElement('div');
    const colorClass = type === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none';
    inner.className = `${colorClass} p-4 rounded-2xl shadow-sm max-w-lg text-sm leading-relaxed relative group`;
    
    const content = document.createElement('p');
    content.className = 'message-text whitespace-pre-wrap';
    content.textContent = text;
    inner.appendChild(content);

    // Citations
    if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'mt-3 space-y-2 border-t border-slate-200 pt-3';
        
        const label = document.createElement('div');
        label.className = 'text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2';
        label.textContent = 'Contextual Sources';
        sourcesDiv.appendChild(label);
        
        sources.forEach(src => {
            const srcEl = document.createElement('div');
            srcEl.className = 'p-2 bg-slate-100 border border-slate-200 rounded text-[9px] leading-relaxed text-slate-500 italic';
            srcEl.textContent = `[${src.id}] ${src.preview} (Relevance: ${src.score})`;
            sourcesDiv.appendChild(srcEl);
        });
        inner.appendChild(sourcesDiv);
    }

    // Meta row (timestamp and badge)
    const meta = document.createElement('div');
    meta.className = 'flex items-center justify-between gap-4 mt-3 pt-3 border-t border-slate-200/50';
    
    if (timestamp) {
        const timeEl = document.createElement('span');
        timeEl.className = `text-[9px] font-medium uppercase tracking-tighter ${type === 'user' ? 'text-indigo-200' : 'text-slate-400'}`;
        timeEl.textContent = timestamp;
        meta.appendChild(timeEl);
    }

    if (type !== 'user' && !id && sender !== 'System') {
        const badge = document.createElement('span');
        badge.className = 'text-[9px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-widest';
        badge.textContent = 'Gemini AI';
        meta.appendChild(badge);
    }

    if (type !== 'system' || timestamp) {
        inner.appendChild(meta);
    }

    div.appendChild(inner);
    chatMessages.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
