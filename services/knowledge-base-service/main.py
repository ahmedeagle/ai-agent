from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
import os
import re
import json
import requests
from datetime import datetime
from bs4 import BeautifulSoup
import uvicorn
import PyPDF2
import io
import csv
from urllib.parse import urljoin, urlparse

# For vector database - using simple in-memory for demo
# In production, use Pinecone, Weaviate, or Chroma
vector_store = {}
qa_store = {}  # Store Q&A pairs separately
website_store = {}  # Store scraped websites
training_history = []  # Track all training activities

app = FastAPI(title="Knowledge Base Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Document(BaseModel):
    id: str
    name: str
    type: str
    content: str
    chunks: int
    embeddings: int
    uploadedAt: datetime
    companyId: str

class SearchQuery(BaseModel):
    query: str
    companyId: str
    topK: int = 5

class SearchResult(BaseModel):
    documentId: str
    documentName: str
    chunkText: str
    similarity: float

class QAPair(BaseModel):
    id: Optional[str] = None
    question: str
    answer: str
    category: Optional[str] = None
    companyId: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class BulkQA(BaseModel):
    qa_pairs: List[Dict[str, str]]
    companyId: str

class WebsiteScrape(BaseModel):
    url: HttpUrl
    companyId: str
    maxPages: Optional[int] = 10
    includePaths: Optional[List[str]] = None

class ManualContent(BaseModel):
    title: str
    content: str
    category: Optional[str] = None
    companyId: str

def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_file = io.BytesIO(content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        return ""

def intelligent_chunk(text: str, chunk_size: int = 500) -> List[str]:
    """Chunk text intelligently at sentence boundaries"""
    # Split by sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) < chunk_size:
            current_chunk += sentence + " "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + " "
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks

def log_training_activity(companyId: str, activity_type: str, details: Dict[str, Any]):
    """Log training activity for audit trail"""
    training_history.append({
        "companyId": companyId,
        "type": activity_type,
        "details": details,
        "timestamp": datetime.now().isoformat()
    })

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    companyId: str = Form(...),
    category: Optional[str] = Form(None)
):
    """
    Upload and process documents (PDF, TXT, DOCX, CSV)
    - Extract text from various formats
    - Intelligent chunking at sentence boundaries
    - Generate embeddings
    - Store in vector database
    """
    try:
        content = await file.read()
        text_content = ""
        
        # Extract text based on file type
        if file.content_type == 'text/plain' or file.filename.endswith('.txt'):
            text_content = content.decode('utf-8')
        elif file.content_type == 'application/pdf' or file.filename.endswith('.pdf'):
            text_content = extract_text_from_pdf(content)
        elif file.filename.endswith('.csv'):
            # Handle CSV as Q&A pairs
            csv_text = content.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(csv_text))
            qa_count = 0
            for row in csv_reader:
                if 'question' in row and 'answer' in row:
                    await add_qa_pair(QAPair(
                        question=row['question'],
                        answer=row['answer'],
                        category=row.get('category'),
                        companyId=companyId
                    ))
                    qa_count += 1
            
            log_training_activity(companyId, "csv_import", {
                "filename": file.filename,
                "qa_pairs": qa_count
            })
            
            return {
                "success": True,
                "message": f"Imported {qa_count} Q&A pairs from CSV",
                "data": {"qa_pairs": qa_count}
            }
        else:
            text_content = content.decode('utf-8', errors='ignore')
        
        if not text_content or len(text_content.strip()) < 10:
            raise HTTPException(status_code=400, detail="Could not extract text from document")
        
        # Intelligent chunking
        chunks = intelligent_chunk(text_content)
        
        doc_id = f"{companyId}_{file.filename}_{int(datetime.now().timestamp())}"
        
        # In production: Generate embeddings using OpenAI
        # embeddings = openai.Embedding.create(input=chunks, model="text-embedding-ada-002")
        
        document = {
            "id": doc_id,
            "name": file.filename,
            "type": file.content_type or "unknown",
            "category": category,
            "content": text_content[:2000],  # Store preview
            "fullContent": text_content,  # Store full text
            "chunks": len(chunks),
            "embeddings": len(chunks),
            "uploadedAt": datetime.now().isoformat(),
            "companyId": companyId,
            "size": f"{len(content) / 1024:.1f} KB",
            "wordCount": len(text_content.split())
        }
        
        # Store in vector DB
        if companyId not in vector_store:
            vector_store[companyId] = []
        vector_store[companyId].append(document)
        
        log_training_activity(companyId, "document_upload", {
            "filename": file.filename,
            "chunks": len(chunks),
            "size": document["size"]
        })
        
        return {
            "success": True,
            "data": document,
            "message": "Document uploaded and processed successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents")
async def get_documents(companyId: str):
    """
    Get all documents for a company
    """
    if companyId not in vector_store:
        return {"success": True, "data": []}
    
    return {
        "success": True,
        "data": vector_store[companyId]
    }

@app.delete("/document/{doc_id}")
async def delete_document(doc_id: str):
    """
    Delete a document and its embeddings
    """
    for company_id, docs in vector_store.items():
        vector_store[company_id] = [d for d in docs if d["id"] != doc_id]
    
    return {"success": True, "message": "Document deleted"}

@app.post("/search")
async def search_knowledge_base(query: SearchQuery):
    """
    Semantic search across knowledge base
    Returns most relevant chunks
    """
    if query.companyId not in vector_store:
        return {"success": True, "data": []}
    
    # In production:
    # 1. Generate embedding for query
    # 2. Perform vector similarity search
    # 3. Return top K results with similarity scores
    
    # Simple keyword search for demo
    results = []
    for doc in vector_store[query.companyId]:
        if query.query.lower() in doc["content"].lower():
            results.append({
                "documentId": doc["id"],
                "documentName": doc["name"],
                "chunkText": doc["content"][:200],
                "similarity": 0.85  # Mock similarity score
            })
    
    return {
        "success": True,
        "data": results[:query.topK]
    }

# ============================================
# Q&A PAIR MANAGEMENT
# ============================================

@app.post("/qa")
async def add_qa_pair(qa: QAPair):
    """Add a single Q&A pair"""
    qa.id = f"qa_{qa.companyId}_{int(datetime.now().timestamp())}"
    qa.createdAt = datetime.now()
    qa.updatedAt = datetime.now()
    
    if qa.companyId not in qa_store:
        qa_store[qa.companyId] = []
    
    qa_store[qa.companyId].append(qa.dict())
    
    log_training_activity(qa.companyId, "qa_added", {
        "question": qa.question[:100],
        "category": qa.category
    })
    
    return {
        "success": True,
        "data": qa.dict(),
        "message": "Q&A pair added successfully"
    }

@app.get("/qa")
async def get_qa_pairs(companyId: str, category: Optional[str] = None):
    """Get all Q&A pairs for a company"""
    if companyId not in qa_store:
        return {"success": True, "data": []}
    
    qa_pairs = qa_store[companyId]
    
    if category:
        qa_pairs = [qa for qa in qa_pairs if qa.get('category') == category]
    
    return {
        "success": True,
        "data": qa_pairs
    }

@app.put("/qa/{qa_id}")
async def update_qa_pair(qa_id: str, qa: QAPair):
    """Update an existing Q&A pair"""
    for company_id, qa_pairs in qa_store.items():
        for i, existing_qa in enumerate(qa_pairs):
            if existing_qa['id'] == qa_id:
                qa.id = qa_id
                qa.updatedAt = datetime.now()
                qa.createdAt = existing_qa['createdAt']
                qa_store[company_id][i] = qa.dict()
                
                log_training_activity(company_id, "qa_updated", {
                    "qa_id": qa_id,
                    "question": qa.question[:100]
                })
                
                return {
                    "success": True,
                    "data": qa.dict(),
                    "message": "Q&A pair updated successfully"
                }
    
    raise HTTPException(status_code=404, detail="Q&A pair not found")

@app.delete("/qa/{qa_id}")
async def delete_qa_pair(qa_id: str):
    """Delete a Q&A pair"""
    for company_id, qa_pairs in qa_store.items():
        qa_store[company_id] = [qa for qa in qa_pairs if qa['id'] != qa_id]
    
    return {"success": True, "message": "Q&A pair deleted"}

@app.post("/qa/bulk")
async def bulk_import_qa(bulk: BulkQA):
    """Bulk import Q&A pairs"""
    imported = 0
    
    for qa_data in bulk.qa_pairs:
        qa = QAPair(
            question=qa_data.get('question', ''),
            answer=qa_data.get('answer', ''),
            category=qa_data.get('category'),
            companyId=bulk.companyId
        )
        await add_qa_pair(qa)
        imported += 1
    
    log_training_activity(bulk.companyId, "bulk_qa_import", {
        "count": imported
    })
    
    return {
        "success": True,
        "message": f"Imported {imported} Q&A pairs",
        "data": {"imported": imported}
    }

# ============================================
# WEBSITE SCRAPING
# ============================================

def scrape_page(url: str) -> Dict[str, Any]:
    """Scrape a single webpage"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        # Get title
        title = soup.title.string if soup.title else url
        
        # Get meta description
        meta_desc = ""
        meta_tag = soup.find('meta', attrs={'name': 'description'})
        if meta_tag:
            meta_desc = meta_tag.get('content', '')
        
        return {
            "url": url,
            "title": title,
            "description": meta_desc,
            "content": text,
            "wordCount": len(text.split()),
            "success": True
        }
    except Exception as e:
        return {
            "url": url,
            "error": str(e),
            "success": False
        }

def get_page_links(url: str, base_domain: str) -> List[str]:
    """Get all links from a page within the same domain"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        links = []
        for link in soup.find_all('a', href=True):
            href = link['href']
            full_url = urljoin(url, href)
            
            # Only include links from same domain
            if urlparse(full_url).netloc == base_domain:
                links.append(full_url)
        
        return list(set(links))  # Remove duplicates
    except:
        return []

@app.post("/scrape")
async def scrape_website(scrape: WebsiteScrape, background_tasks: BackgroundTasks):
    """
    Scrape a website and extract content
    - Crawl multiple pages
    - Extract text content
    - Generate embeddings
    - Store in knowledge base
    """
    try:
        base_url = str(scrape.url)
        base_domain = urlparse(base_url).netloc
        
        # Scrape initial page
        result = scrape_page(base_url)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Failed to scrape URL'))
        
        scraped_pages = [result]
        visited_urls = {base_url}
        
        # Get links and scrape more pages (up to maxPages)
        if scrape.maxPages > 1:
            links = get_page_links(base_url, base_domain)
            
            for link in links[:scrape.maxPages - 1]:
                if link not in visited_urls:
                    page_result = scrape_page(link)
                    if page_result['success']:
                        scraped_pages.append(page_result)
                    visited_urls.add(link)
        
        # Store scraped content
        website_id = f"web_{scrape.companyId}_{int(datetime.now().timestamp())}"
        
        website_data = {
            "id": website_id,
            "baseUrl": base_url,
            "domain": base_domain,
            "pagesScraped": len(scraped_pages),
            "pages": scraped_pages,
            "totalWords": sum(p.get('wordCount', 0) for p in scraped_pages),
            "companyId": scrape.companyId,
            "scrapedAt": datetime.now().isoformat()
        }
        
        if scrape.companyId not in website_store:
            website_store[scrape.companyId] = []
        
        website_store[scrape.companyId].append(website_data)
        
        # Also create document entries for each page
        for page in scraped_pages:
            if page['success']:
                chunks = intelligent_chunk(page['content'])
                
                doc = {
                    "id": f"{website_id}_{page['url']}",
                    "name": page['title'],
                    "type": "webpage",
                    "category": "website",
                    "url": page['url'],
                    "content": page['content'][:2000],
                    "fullContent": page['content'],
                    "chunks": len(chunks),
                    "embeddings": len(chunks),
                    "uploadedAt": datetime.now().isoformat(),
                    "companyId": scrape.companyId,
                    "wordCount": page['wordCount']
                }
                
                if scrape.companyId not in vector_store:
                    vector_store[scrape.companyId] = []
                vector_store[scrape.companyId].append(doc)
        
        log_training_activity(scrape.companyId, "website_scraped", {
            "url": base_url,
            "pages": len(scraped_pages),
            "totalWords": website_data['totalWords']
        })
        
        return {
            "success": True,
            "data": website_data,
            "message": f"Successfully scraped {len(scraped_pages)} pages from {base_domain}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/websites")
async def get_scraped_websites(companyId: str):
    """Get all scraped websites for a company"""
    if companyId not in website_store:
        return {"success": True, "data": []}
    
    return {
        "success": True,
        "data": website_store[companyId]
    }

# ============================================
# MANUAL CONTENT ENTRY
# ============================================

@app.post("/content")
async def add_manual_content(content: ManualContent):
    """Add manual content entry"""
    chunks = intelligent_chunk(content.content)
    
    doc_id = f"manual_{content.companyId}_{int(datetime.now().timestamp())}"
    
    document = {
        "id": doc_id,
        "name": content.title,
        "type": "manual",
        "category": content.category,
        "content": content.content[:2000],
        "fullContent": content.content,
        "chunks": len(chunks),
        "embeddings": len(chunks),
        "uploadedAt": datetime.now().isoformat(),
        "companyId": content.companyId,
        "wordCount": len(content.content.split())
    }
    
    if content.companyId not in vector_store:
        vector_store[content.companyId] = []
    vector_store[content.companyId].append(document)
    
    log_training_activity(content.companyId, "manual_content", {
        "title": content.title,
        "wordCount": document['wordCount']
    })
    
    return {
        "success": True,
        "data": document,
        "message": "Content added successfully"
    }

# ============================================
# TRAINING HISTORY & STATS
# ============================================

@app.get("/history")
async def get_training_history(companyId: str, limit: int = 50):
    """Get training activity history"""
    company_history = [
        h for h in training_history 
        if h['companyId'] == companyId
    ]
    
    # Sort by timestamp descending
    company_history.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return {
        "success": True,
        "data": company_history[:limit]
    }

@app.get("/stats")
async def get_knowledge_stats(companyId: str):
    """Get comprehensive knowledge base statistics"""
    docs = vector_store.get(companyId, [])
    qa_pairs = qa_store.get(companyId, [])
    websites = website_store.get(companyId, [])
    
    return {
        "success": True,
        "data": {
            "documents": len(docs),
            "totalChunks": sum(d.get('chunks', 0) for d in docs),
            "totalEmbeddings": sum(d.get('embeddings', 0) for d in docs),
            "qaPairs": len(qa_pairs),
            "websites": len(websites),
            "totalPages": sum(w.get('pagesScraped', 0) for w in websites),
            "totalWords": sum(d.get('wordCount', 0) for d in docs) + sum(w.get('totalWords', 0) for w in websites),
            "categories": list(set(
                d.get('category') for d in docs if d.get('category')
            ) | set(
                qa.get('category') for qa in qa_pairs if qa.get('category')
            ))
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "knowledge-base",
        "stats": {
            "documentsStored": sum(len(docs) for docs in vector_store.values()),
            "qaPairs": sum(len(qa) for qa in qa_store.values()),
            "websitesScraped": sum(len(sites) for sites in website_store.values()),
            "trainingActivities": len(training_history)
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 3008)),
        reload=True
    )
