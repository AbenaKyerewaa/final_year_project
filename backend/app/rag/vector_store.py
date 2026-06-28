import os
import json
import numpy as np
import faiss
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

# Base directory for storing serialized vector indices
INDICES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "vector_indices")

class BaseVectorStore(ABC):
    """Abstract interface defining the contract for EasyBiz AI Vector Database adapters."""
    
    @abstractmethod
    def add_documents(
        self, 
        business_id: str, 
        texts: List[str], 
        metadatas: List[Dict[str, Any]], 
        embeddings: List[List[float]]
    ) -> None:
        """Adds texts and their respective metadata/embeddings to the vector store scoped by business_id."""
        pass

    @abstractmethod
    def query(
        self, 
        business_id: str, 
        query_embedding: List[float], 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Queries the vector index for a business, returning top matches sorted by cosine similarity."""
        pass

    @abstractmethod
    def delete_business_index(self, business_id: str) -> None:
        """Deletes the entire vector index files and directory for a specific business."""
        pass


class FAISSVectorStore(BaseVectorStore):
    """FAISS-backed vector store implementing strict metadata/index file segregation per business_id."""
    
    def _get_paths(self, business_id: str):
        business_dir = os.path.join(INDICES_DIR, str(business_id))
        index_path = os.path.join(business_dir, "index.faiss")
        meta_path = os.path.join(business_dir, "metadata.json")
        return business_dir, index_path, meta_path

    def add_documents(
        self, 
        business_id: str, 
        texts: List[str], 
        metadatas: List[Dict[str, Any]], 
        embeddings: List[List[float]]
    ) -> None:
        if not texts or not embeddings:
            return
            
        business_dir, index_path, meta_path = self._get_paths(business_id)
        os.makedirs(business_dir, exist_ok=True)
        
        # 1. Normalize embeddings to allow Cosine Similarity search via Inner Product (IndexFlatIP)
        vectors = np.array(embeddings, dtype=np.float32)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)  # Prevent division by zero
        normalized_vectors = vectors / norms
        
        dimension = normalized_vectors.shape[1]
        
        # 2. Build the FAISS Index
        index = faiss.IndexFlatIP(dimension)
        index.add(normalized_vectors)
        
        # 3. Save index to disk
        faiss.write_index(index, index_path)
        
        # 4. Save corresponding metadata blocks
        metadata_list = []
        for text, meta in zip(texts, metadatas):
            metadata_list.append({
                "text": text,
                "metadata": meta
            })
            
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata_list, f, ensure_ascii=False, indent=2)

    def query(
        self, 
        business_id: str, 
        query_embedding: List[float], 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        _, index_path, meta_path = self._get_paths(business_id)
        
        # Guard if no index exists for this business yet
        if not os.path.exists(index_path) or not os.path.exists(meta_path):
            return []
            
        try:
            # 1. Read index and metadata from disk
            index = faiss.read_index(index_path)
            with open(meta_path, "r", encoding="utf-8") as f:
                metadata_list = json.load(f)
                
            # 2. Normalize query vector
            q_vec = np.array([query_embedding], dtype=np.float32)
            norm = np.linalg.norm(q_vec)
            if norm > 0:
                q_vec = q_vec / norm
                
            # 3. Query the index
            # search returns (distances, indexes)
            distances, indices = index.search(q_vec, limit)
            
            # 4. Map results
            results = []
            for dist, idx in zip(distances[0], indices[0]):
                if idx == -1 or idx >= len(metadata_list):
                    continue
                item = metadata_list[idx]
                results.append({
                    "text": item["text"],
                    "metadata": item["metadata"],
                    "score": float(dist)  # Cosine similarity score [0.0, 1.0]
                })
            return results
        except Exception as e:
            print(f"Error querying FAISS index for business {business_id}: {e}")
            return []

    def delete_business_index(self, business_id: str) -> None:
        business_dir, index_path, meta_path = self._get_paths(business_id)
        
        # Delete index file
        if os.path.exists(index_path):
            try:
                os.remove(index_path)
            except Exception as e:
                print(f"Error deleting index file: {e}")
                
        # Delete metadata file
        if os.path.exists(meta_path):
            try:
                os.remove(meta_path)
            except Exception as e:
                print(f"Error deleting metadata file: {e}")
                
        # Delete directory if empty
        if os.path.exists(business_dir):
            try:
                if not os.listdir(business_dir):
                    os.rmdir(business_dir)
            except Exception as e:
                print(f"Error removing business index directory: {e}")
