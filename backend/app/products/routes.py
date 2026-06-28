import uuid
import csv
import io
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.products.models import Product
from app.businesses.models import Business
from app.auth.models import User
from app.auth.security import get_current_user
from app.rag.indexer import index_business_data

router = APIRouter()

# --- Pydantic Schemas ---

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    price: Decimal = Field(..., ge=0, decimal_places=2)
    currency: str = Field("GHS", max_length=10)
    quantity: int = Field(0, ge=0)
    availability_status: str = Field("available", max_length=50) # available, out_of_stock, limited
    warranty: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = Field(None, max_length=500)

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    currency: Optional[str] = Field(None, max_length=10)
    quantity: Optional[int] = Field(None, ge=0)
    availability_status: Optional[str] = Field(None, max_length=50)
    warranty: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = Field(None, max_length=500)

class ProductResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    category: Optional[str]
    description: Optional[str]
    price: Decimal
    currency: str
    quantity: int
    availability_status: str
    warranty: Optional[str]
    image_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Helper Permission Function ---

def verify_business_access(business_id: uuid.UUID, db: Session, current_user: User):
    """Verifies that the current user is owner, staff, or admin of the targeted business."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found"
        )
        
    is_owner = business.owner_id == current_user.id
    is_staff = current_user.role == "staff"
    is_admin = current_user.role == "admin"
    
    if not (is_owner or is_staff or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage resources for this business profile"
        )
    return business


# --- API Routes ---

@router.post("/businesses/{business_id}/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    business_id: uuid.UUID,
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new product under a business profile. Only owner, staff, or admin permitted."""
    verify_business_access(business_id, db, current_user)
    
    new_product = Product(
        business_id=business_id,
        name=payload.name.strip(),
        category=payload.category.strip() if payload.category else None,
        description=payload.description.strip() if payload.description else None,
        price=payload.price,
        currency=payload.currency.strip(),
        quantity=payload.quantity,
        availability_status=payload.availability_status.strip().lower(),
        warranty=payload.warranty.strip() if payload.warranty else None,
        image_url=payload.image_url.strip() if payload.image_url else None
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product


@router.get("/businesses/{business_id}/products", response_model=List[ProductResponse])
def list_products(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all products of a business profile. Scoped to authorized owner, staff, or admin."""
    verify_business_access(business_id, db, current_user)
    return db.query(Product).filter(Product.business_id == business_id).all()


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves detailed information of a single product. Scoped to authorized owner, staff, or admin."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    verify_business_access(product.business_id, db, current_user)
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates a product profile. Scoped to authorized owner, staff, or admin."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    verify_business_access(product.business_id, db, current_user)
    
    # Update fields if provided
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if isinstance(value, str):
                value = value.strip()
            setattr(product, field, value)
            
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a product item securely. Scoped to authorized owner, staff, or admin."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    verify_business_access(product.business_id, db, current_user)
    
    db.delete(product)
    db.commit()
    return None


class ImportSummary(BaseModel):
    total_rows: int
    successful_rows: int
    failed_rows: int
    errors: List[str]


@router.post("/businesses/{business_id}/products/import-csv", response_model=ImportSummary)
def import_products_csv(
    business_id: uuid.UUID,
    file: UploadFile = File(...),
    reindex_after_import: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk import products from a CSV file. Validates fields, skips empty rows, and logs errors."""
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
    required_headers = ["name", "price"]
    for rh in required_headers:
        if rh not in headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required CSV header: '{rh}'. Expected headers: name,category,description,price,currency,quantity,availability_status,warranty"
            )

    # Map headers to indices
    header_map = {h: idx for idx, h in enumerate(headers)}

    total_rows = 0
    successful_rows = 0
    failed_rows = 0
    errors = []

    valid_products = []

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

        # Validate name
        name = get_val("name")
        if not name:
            failed_rows += 1
            errors.append(f"Row {row_num}: Product 'name' is required and cannot be empty.")
            continue

        # Validate price
        price_str = get_val("price")
        try:
            price = float(price_str)
            if price < 0:
                raise ValueError("Price cannot be negative.")
        except (ValueError, TypeError):
            failed_rows += 1
            errors.append(f"Row {row_num}: Product '{name}' has invalid price '{price_str}'. Price must be a positive number.")
            continue

        # Validate quantity
        qty_str = get_val("quantity", "0")
        try:
            quantity = int(qty_str) if qty_str else 0
            if quantity < 0:
                raise ValueError("Quantity cannot be negative.")
        except (ValueError, TypeError):
            failed_rows += 1
            errors.append(f"Row {row_num}: Product '{name}' has invalid quantity '{qty_str}'. Quantity must be a non-negative integer.")
            continue

        category = get_val("category") or None
        description = get_val("description") or None
        currency = get_val("currency", "GHS") or "GHS"
        availability_status = get_val("availability_status", "available") or "available"
        warranty = get_val("warranty") or None

        # Build product
        new_prod = Product(
            business_id=business_id,
            name=name,
            category=category,
            description=description,
            price=price,
            currency=currency,
            quantity=quantity,
            availability_status=availability_status.lower(),
            warranty=warranty
        )
        valid_products.append(new_prod)
        successful_rows += 1

    # 4. Save to Database
    if valid_products:
        db.add_all(valid_products)
        db.commit()

    # 5. Trigger Reindexing if requested and there are successful items
    if reindex_after_import and successful_rows > 0:
        try:
            index_business_data(business_id, db)
        except Exception as e:
            errors.append(f"System: Products saved but RAG index rebuild failed: {str(e)}")

    return ImportSummary(
        total_rows=total_rows,
        successful_rows=successful_rows,
        failed_rows=failed_rows,
        errors=errors
    )

