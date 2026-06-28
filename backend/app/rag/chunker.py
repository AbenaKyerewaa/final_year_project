from datetime import datetime
from typing import List, Dict, Any, Tuple
from app.rag.text_converters import (
    convert_business_to_text,
    convert_product_to_text,
    convert_service_to_text,
    convert_faq_to_text
)

def chunk_document_text(text: str, chunk_size_words: int = 400, overlap_words: int = 50) -> List[str]:
    """Splits a document text block into overlapping segments based on word count."""
    words = text.split()
    if not words:
        return []
    if len(words) <= chunk_size_words:
        return [text]
        
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size_words
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))
        
        # Advance index by step
        start += (chunk_size_words - overlap_words)
        
        # Prevent infinite loops if values are misconfigured
        if chunk_size_words <= overlap_words:
            break
            
    return chunks


def prepare_business_chunks(
    business, 
    products: List[Any], 
    services: List[Any], 
    faqs: List[Any], 
    documents: List[Any]
) -> List[Tuple[str, Dict[str, Any]]]:
    """Processes all entities for a business, yielding text chunks and structured metadata ready for embedding."""
    chunks_with_metadata = []
    b_id = str(business.id)
    
    # Helper to convert datetime to ISO string safely
    def get_iso_time(dt) -> str:
        if isinstance(dt, datetime):
            return dt.isoformat()
        return str(dt) if dt else datetime.utcnow().isoformat()

    # 1. Process Business Profile (1 chunk)
    profile_text = convert_business_to_text(business)
    chunks_with_metadata.append((
        profile_text,
        {
            "business_id": b_id,
            "source_type": "profile",
            "source_id": b_id,
            "title": "Business Profile",
            "created_at": get_iso_time(business.created_at),
            "updated_at": get_iso_time(business.updated_at)
        }
    ))

    # 2. Process Products (1 chunk per product)
    for prod in products:
        prod_text = convert_product_to_text(prod)
        chunks_with_metadata.append((
            prod_text,
            {
                "business_id": b_id,
                "source_type": "product",
                "source_id": str(prod.id),
                "title": prod.name,
                "created_at": get_iso_time(prod.created_at),
                "updated_at": get_iso_time(prod.updated_at)
            }
        ))

    # 3. Process Services (1 chunk per service)
    for serv in services:
        serv_text = convert_service_to_text(serv)
        chunks_with_metadata.append((
            serv_text,
            {
                "business_id": b_id,
                "source_type": "service",
                "source_id": str(serv.id),
                "title": serv.name,
                "created_at": get_iso_time(serv.created_at),
                "updated_at": get_iso_time(serv.updated_at)
            }
        ))

    # 4. Process FAQs (1 chunk per FAQ)
    for faq in faqs:
        faq_text = convert_faq_to_text(faq)
        chunks_with_metadata.append((
            faq_text,
            {
                "business_id": b_id,
                "source_type": "faq",
                "source_id": str(faq.id),
                "title": faq.question[:60],
                "created_at": get_iso_time(faq.created_at),
                "updated_at": get_iso_time(faq.updated_at)
            }
        ))

    # 5. Process Processed Documents (Split into 300-500 words chunks)
    for doc in documents:
        # Index only processed documents that have text content
        if doc.processed_status == "processed" and doc.extracted_text:
            doc_chunks = chunk_document_text(doc.extracted_text, chunk_size_words=400, overlap_words=50)
            
            for idx, chunk_text in enumerate(doc_chunks):
                chunks_with_metadata.append((
                    chunk_text,
                    {
                        "business_id": b_id,
                        "source_type": "document",
                        "source_id": str(doc.id),
                        "title": f"{doc.file_name} - Part {idx + 1}",
                        "created_at": get_iso_time(doc.created_at),
                        "updated_at": get_iso_time(doc.updated_at)
                    }
                ))

    return chunks_with_metadata
