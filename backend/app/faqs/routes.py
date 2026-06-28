import uuid
import csv
import io
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.faqs.models import FAQ
from app.auth.models import User
from app.auth.security import get_current_user
from app.products.routes import verify_business_access
from app.rag.indexer import index_business_data

router = APIRouter()

# --- Pydantic Schemas ---

class FAQCreate(BaseModel):
    question: str = Field(..., min_length=1, description="The FAQ question")
    answer: str = Field(..., min_length=1, description="The answer to the FAQ")

class FAQUpdate(BaseModel):
    question: Optional[str] = Field(None, min_length=1, description="The FAQ question")
    answer: Optional[str] = Field(None, min_length=1, description="The answer to the FAQ")

class FAQResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    question: str
    answer: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- API Routes ---

@router.post("/businesses/{business_id}/faqs", response_model=FAQResponse, status_code=status.HTTP_201_CREATED)
def create_faq(
    business_id: uuid.UUID,
    payload: FAQCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new FAQ for a business profile. Only owner, staff, or admin permitted."""
    verify_business_access(business_id, db, current_user)
    
    new_faq = FAQ(
        business_id=business_id,
        question=payload.question.strip(),
        answer=payload.answer.strip()
    )
    db.add(new_faq)
    db.commit()
    db.refresh(new_faq)
    return new_faq


@router.get("/businesses/{business_id}/faqs", response_model=List[FAQResponse])
def list_faqs(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all FAQs of a business profile. Scoped to authorized owner, staff, or admin."""
    verify_business_access(business_id, db, current_user)
    return db.query(FAQ).filter(FAQ.business_id == business_id).order_by(FAQ.created_at.desc()).all()


@router.get("/faqs/{faq_id}", response_model=FAQResponse)
def get_faq(
    faq_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves detailed information of a single FAQ. Scoped to authorized owner, staff, or admin."""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FAQ not found"
        )
    
    verify_business_access(faq.business_id, db, current_user)
    return faq


@router.put("/faqs/{faq_id}", response_model=FAQResponse)
def update_faq(
    faq_id: uuid.UUID,
    payload: FAQUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates an FAQ. Scoped to authorized owner, staff, or admin."""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FAQ not found"
        )
    
    verify_business_access(faq.business_id, db, current_user)
    
    # Update fields if provided
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(faq, field, value.strip())
            
    db.commit()
    db.refresh(faq)
    return faq


@router.delete("/faqs/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faq(
    faq_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes an FAQ securely. Scoped to authorized owner, staff, or admin."""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FAQ not found"
        )
    
    verify_business_access(faq.business_id, db, current_user)
    
    db.delete(faq)
    db.commit()
    return None


class FAQImportSummary(BaseModel):
    total_rows: int
    successful_rows: int
    failed_rows: int
    errors: List[str]


@router.post("/businesses/{business_id}/faqs/import-csv", response_model=FAQImportSummary)
def import_faqs_csv(
    business_id: uuid.UUID,
    file: UploadFile = File(...),
    reindex_after_import: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk import FAQs from a CSV file. Validates headers and cells, skips empty rows, and logs errors."""
    verify_business_access(business_id, db, current_user)

    # 1. Read file content
    try:
        content = file.file.read().decode("utf-8-sig")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}"
        )

    # 2. Parse CSV
    csv_file = io.StringIO(content)
    reader = csv.reader(csv_file)
    
    # Get header row
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded CSV file is empty."
        )

    # Clean headers (strip spaces and lowercase)
    headers = [h.strip().lower() for h in headers]

    # Required headers check
    required_headers = ["question", "answer"]
    for rh in required_headers:
        if rh not in headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required CSV header: '{rh}'. Expected headers: question,answer"
            )

    # Map headers to indices
    header_map = {h: idx for idx, h in enumerate(headers)}

    total_rows = 0
    successful_rows = 0
    failed_rows = 0
    errors = []

    valid_faqs = []

    # 3. Process rows
    for row_num, row in enumerate(reader, start=2): # Headers is row 1
        # Skip empty rows
        if not row or all(cell.strip() == "" for cell in row):
            continue

        total_rows += 1

        # Check that row has enough cells (match header length)
        if len(row) < len(headers):
            row = row + [""] * (len(headers) - len(row))

        # Helper to get value or default
        def get_val(header_name: str, default_val: str = "") -> str:
            if header_name in header_map:
                idx = header_map[header_name]
                if idx < len(row):
                    return row[idx].strip()
            return default_val

        # Validate question and answer
        question = get_val("question")
        answer = get_val("answer")

        if not question:
            failed_rows += 1
            errors.append(f"Row {row_num}: FAQ 'question' is required and cannot be empty.")
            continue

        if not answer:
            failed_rows += 1
            errors.append(f"Row {row_num}: FAQ 'answer' is required and cannot be empty.")
            continue

        # Build FAQ
        new_faq = FAQ(
            business_id=business_id,
            question=question,
            answer=answer
        )
        valid_faqs.append(new_faq)
        successful_rows += 1

    # 4. Save to Database
    if valid_faqs:
        db.add_all(valid_faqs)
        db.commit()

    # 5. Trigger Reindexing if requested and there are successful items
    if reindex_after_import and successful_rows > 0:
        try:
            index_business_data(business_id, db)
        except Exception as e:
            errors.append(f"System: FAQs saved but RAG index rebuild failed: {str(e)}")

    return FAQImportSummary(
        total_rows=total_rows,
        successful_rows=successful_rows,
        failed_rows=failed_rows,
        errors=errors
    )

