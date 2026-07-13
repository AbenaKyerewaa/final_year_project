import uuid
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.models import Service
from app.businesses.models import Business
from app.auth.models import User
from app.auth.security import get_current_user
from app.products.routes import verify_business_access
from app.rag.indexer import index_business_data
import csv
import io
import re

router = APIRouter()

# --- Pydantic Schemas ---

class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    price: Decimal = Field(..., ge=0, decimal_places=2)
    currency: str = Field("GHS", max_length=10)
    duration: Optional[str] = Field(None, max_length=50, pattern=r"^\s*\d+\s*(-\s*\d+)?\s*$")
    duration_unit: Optional[str] = Field("minutes", max_length=20)
    availability_status: str = Field("available", max_length=50) # available, unavailable

class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    currency: Optional[str] = Field(None, max_length=10)
    duration: Optional[str] = Field(None, max_length=50, pattern=r"^\s*\d+\s*(-\s*\d+)?\s*$")
    duration_unit: Optional[str] = Field(None, max_length=20)
    availability_status: Optional[str] = Field(None, max_length=50)

class ServiceResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    description: Optional[str]
    price: Decimal
    currency: str
    duration: Optional[str]
    duration_unit: str
    availability_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- API Routes ---

@router.post("/businesses/{business_id}/services", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(
    business_id: uuid.UUID,
    payload: ServiceCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new service under a business profile. Only owner, staff, or admin permitted."""
    verify_business_access(business_id, db, current_user)
    
    new_service = Service(
        business_id=business_id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        price=payload.price,
        currency=payload.currency.strip(),
        duration=payload.duration.strip() if payload.duration else None,
        duration_unit=payload.duration_unit.strip().lower() if payload.duration_unit else "minutes",
        availability_status=payload.availability_status.strip().lower()
    )
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    
    # Rebuild search index in background to keep RAG chatbot in sync
    background_tasks.add_task(index_business_data, business_id, db)
    
    return new_service


@router.get("/businesses/{business_id}/services", response_model=List[ServiceResponse])
def list_services(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all services of a business profile. Scoped to authorized owner, staff, or admin."""
    verify_business_access(business_id, db, current_user)
    return db.query(Service).filter(Service.business_id == business_id).all()


@router.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(
    service_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves detailed information of a single service. Scoped to authorized owner, staff, or admin."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    verify_business_access(service.business_id, db, current_user)
    return service


@router.put("/services/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates a service profile. Scoped to authorized owner, staff, or admin."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    verify_business_access(service.business_id, db, current_user)
    
    # Update fields if provided
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if isinstance(value, str):
                value = value.strip()
            setattr(service, field, value)
            
    db.commit()
    db.refresh(service)
    
    # Rebuild search index in background to keep RAG chatbot in sync
    background_tasks.add_task(index_business_data, service.business_id, db)
    
    return service


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a service item securely. Scoped to authorized owner, staff, or admin."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    verify_business_access(service.business_id, db, current_user)
    business_id = service.business_id
    
    db.delete(service)
    db.commit()
    
    # Rebuild search index in background to keep RAG chatbot in sync
    background_tasks.add_task(index_business_data, business_id, db)
    
    return None


class ServiceImportSummary(BaseModel):
    total_rows: int
    successful_rows: int
    failed_rows: int
    errors: List[str]


@router.post("/businesses/{business_id}/services/import-csv", response_model=ServiceImportSummary)
def import_services_csv(
    business_id: uuid.UUID,
    file: UploadFile = File(...),
    reindex_after_import: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk import services from a CSV file. Validates fields, cleans duration range & unit, and logs errors."""
    verify_business_access(business_id, db, current_user)

    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    business_category = business.category or ""

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

    # Required headers check: we need some form of 'service details' / 'service name' / 'fee name' / 'name' AND 'price'
    name_header_options = ["service details", "service name", "fee name", "name"]
    name_header = None
    for opt in name_header_options:
        if opt in headers:
            name_header = opt
            break

    if not name_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing service name header in CSV. Expected one of: {', '.join(name_header_options)}"
        )

    if "price" not in headers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required CSV header: 'price'."
        )

    # Map headers to indices
    header_map = {h: idx for idx, h in enumerate(headers)}

    total_rows = 0
    successful_rows = 0
    failed_rows = 0
    errors = []

    valid_services = []

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
        def get_val(header_names: list, default_val: str = "") -> str:
            for name in header_names:
                if name in header_map:
                    idx = header_map[name]
                    if idx < len(row):
                        return row[idx].strip()
            return default_val

        # Validate name
        name = get_val([name_header])
        if not name:
            failed_rows += 1
            errors.append(f"Row {row_num}: Service name / details is required and cannot be empty.")
            continue

        # Validate price
        price_str = get_val(["price"])
        try:
            price = Decimal(price_str)
            if price < 0:
                raise ValueError("Price cannot be negative.")
        except (ValueError, TypeError):
            failed_rows += 1
            errors.append(f"Row {row_num}: Service '{name}' has invalid price '{price_str}'. Price must be a positive number.")
            continue

        # Parse and validate duration and unit
        # Headers mapping options for duration and duration_unit
        duration_val = get_val(["duration", "billing unit", "service unit", "billing_unit", "service_unit"])
        duration_unit_val = get_val(["duration unit", "duration_unit", "billing unit", "service unit", "billing_unit", "service_unit"])

        # We clean and parse
        duration = None
        duration_unit = "minutes"

        # Determine default duration unit based on business category
        cat_lower = business_category.lower()
        if any(k in cat_lower for k in ["education", "school", "academy"]):
            duration_unit = "term"
        elif any(k in cat_lower for k in ["food", "beverage", "restaurant", "cafe"]):
            duration_unit = "booking"

        if duration_val:
            # Check unit in raw duration string or dedicated duration unit column
            unit_search_str = f"{duration_val} {duration_unit_val}".lower()
            if "minute" in unit_search_str or "min" in unit_search_str:
                duration_unit = "minutes"
            elif "hour" in unit_search_str or "hr" in unit_search_str:
                duration_unit = "hours"
            elif "day" in unit_search_str:
                duration_unit = "days"
            elif "term" in unit_search_str:
                duration_unit = "term"
            elif "month" in unit_search_str:
                duration_unit = "month"
            elif "booking" in unit_search_str:
                duration_unit = "booking"
            elif "guest" in unit_search_str:
                duration_unit = "guest"
            elif "delivery" in unit_search_str:
                duration_unit = "delivery"
            elif "one-time" in unit_search_str or "one time" in unit_search_str:
                duration_unit = "one-time"

            # Extract digits and hyphens (duration range)
            cleaned_dur = re.sub(r'[^0-9\-]', '', duration_val).strip()
            cleaned_dur = re.sub(r'-+', '-', cleaned_dur)
            cleaned_dur = cleaned_dur.strip('-')
            if cleaned_dur:
                # Validate cleaned duration with regex pattern: ^\s*\d+\s*(-\s*\d+)?\s*$
                if not re.match(r"^\s*\d+\s*(-\s*\d+)?\s*$", cleaned_dur):
                    failed_rows += 1
                    errors.append(f"Row {row_num}: Service '{name}' has invalid duration format '{duration_val}'. Must be a number or a range (e.g. 30 or 15-20).")
                    continue
                duration = cleaned_dur

        # Description
        description = get_val(["description"]) or None
        
        # Currency (defaults to GHS)
        currency = get_val(["currency"]) or "GHS"

        # Availability status (status or availability_status)
        status_val = get_val(["status", "availability_status", "availability status"]) or "available"
        availability_status = "available"
        if status_val.lower() in ["unavailable", "out_of_stock", "inactive", "false", "0"]:
            availability_status = "unavailable"

        new_serv = Service(
            business_id=business_id,
            name=name,
            description=description,
            price=price,
            currency=currency,
            duration=duration,
            duration_unit=duration_unit,
            availability_status=availability_status
        )
        valid_services.append(new_serv)
        successful_rows += 1

    # 4. Save to Database
    if valid_services:
        db.add_all(valid_services)
        db.commit()

    # 5. Trigger Reindexing if requested and there are successful items
    if reindex_after_import and successful_rows > 0:
        try:
            index_business_data(business_id, db)
        except Exception as e:
            errors.append(f"System: Services saved but RAG index rebuild failed: {str(e)}")

    return ServiceImportSummary(
        total_rows=total_rows,
        successful_rows=successful_rows,
        failed_rows=failed_rows,
        errors=errors
    )
