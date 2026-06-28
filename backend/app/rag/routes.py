import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.auth.models import User
from app.auth.security import get_current_user
from app.products.routes import verify_business_access
from app.rag.indexer import index_business_data

router = APIRouter()

@router.post("/businesses/{business_id}/rag/reindex", status_code=status.HTTP_200_OK)
def reindex_business(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Triggers complete vector rebuilding and indexing of business profiles, inventory, FAQs, and documents.
    Only authorized business owners, staff, or admins are permitted to trigger indexing.
    """
    # 1. Enforce permission verification
    verify_business_access(business_id, db, current_user)
    
    # 2. Run indexing synchronously (can block briefly while computing embeddings)
    try:
        results = index_business_data(business_id, db)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reindexing failed for business {business_id}: {str(e)}"
        )
