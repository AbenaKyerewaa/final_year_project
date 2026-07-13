import time
import uuid
from sqlalchemy.orm import Session
from app.database import base
# Import models directly from base to ensure declarative mapping resolves correctly
from app.businesses.models import Business
from app.products.models import Product
from app.services.models import Service
from app.faqs.models import FAQ
from app.documents.models import Document

from app.rag.chunker import prepare_business_chunks
from app.rag.vector_store import FAISSVectorStore
from app.ai_providers import AIService

def delete_business_index(business_id: uuid.UUID) -> None:
    """Deletes the vector store files and folder for a business index."""
    print(f"[RAG Indexer] Triggering deletion of index for business {business_id}...")
    store = FAISSVectorStore()
    store.delete_business_index(str(business_id))
    print(f"[RAG Indexer] Index files deleted successfully for business {business_id}.")


def index_business_data(business_id: uuid.UUID, db: Session) -> dict:
    """Rebuilds the complete searchable vector store for a business by parsing and embedding all assets."""
    start_time = time.time()
    b_str = str(business_id)
    print(f"[RAG Indexer] Starting indexing process for business {business_id}...")
    
    # 1. Fetch business profile
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise ValueError(f"Business profile with ID {business_id} not found.")
        
    # 2. Fetch associated products, services, FAQs, and documents
    products = db.query(Product).filter(Product.business_id == business_id).all()
    services = db.query(Service).filter(Service.business_id == business_id).all()
    faqs = db.query(FAQ).filter(FAQ.business_id == business_id).all()
    documents = db.query(Document).filter(Document.business_id == business_id).all()
    
    print(f"[RAG Indexer] Found: {len(products)} products, {len(services)} services, {len(faqs)} FAQs, {len(documents)} documents.")
    
    # 3. Clear existing index files on disk
    delete_business_index(business_id)
    
    # 4. Partition data into chunks with metadata
    chunks_with_metadata = prepare_business_chunks(
        business=business,
        products=products,
        services=services,
        faqs=faqs,
        documents=documents
    )
    
    total_chunks = len(chunks_with_metadata)
    print(f"[RAG Indexer] Structured data partitioned into {total_chunks} total chunks.")
    
    if total_chunks == 0:
        return {
            "business_id": b_str,
            "status": "success",
            "chunks_indexed": 0,
            "elapsed_seconds": round(time.time() - start_time, 3),
            "message": "No data available to index."
        }
        
    # 5. Extract texts and metadatas lists
    texts = [item[0] for item in chunks_with_metadata]
    metadatas = [item[1] for item in chunks_with_metadata]
    
    # 6. Generate Embeddings in batch using the active provider
    print("[RAG Indexer] Obtaining vector embeddings for chunks...")
    ai_service = AIService()
    embeddings = ai_service.embed_batch(texts)
    
    # 7. Write vectors and metadata to disk
    print("[RAG Indexer] Saving vector indexes to disk...")
    store = FAISSVectorStore()
    store.add_documents(
        business_id=b_str,
        texts=texts,
        metadatas=metadatas,
        embeddings=embeddings
    )
    
    elapsed = time.time() - start_time
    print(f"[RAG Indexer] SUCCESS: Indexed {total_chunks} chunks in {elapsed:.3f} seconds.")
    
    return {
        "business_id": b_str,
        "status": "success",
        "chunks_indexed": total_chunks,
        "elapsed_seconds": round(elapsed, 3),
        "message": f"Successfully indexed {total_chunks} blocks of knowledge."
    }
