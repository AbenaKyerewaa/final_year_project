import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.businesses.models import Business
from app.auth.models import User
from app.auth.security import get_current_user

router = APIRouter()

# --- Pydantic Schemas ---

class BusinessCreate(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    location: str = Field(..., min_length=1, max_length=255)
    phone: str = Field(..., min_length=1, max_length=50)
    whatsapp_number: Optional[str] = Field(None, max_length=50)
    opening_hours: Optional[str] = None
    payment_methods: Optional[str] = None
    delivery_options: Optional[str] = None
    description: Optional[str] = None

class BusinessUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, min_length=1, max_length=50)
    whatsapp_number: Optional[str] = Field(None, max_length=50)
    opening_hours: Optional[str] = None
    payment_methods: Optional[str] = None
    delivery_options: Optional[str] = None
    description: Optional[str] = None

class BusinessResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    business_name: str
    category: str
    location: str
    phone: str
    whatsapp_number: Optional[str]
    opening_hours: Optional[str]
    payment_methods: Optional[str]
    delivery_options: Optional[str]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- API Routes ---

@router.post("/", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new business profile scoped to the current logged-in user."""
    # Ensure role supports creation (all roles can create business profiles, but staff usually don't. However, let's keep it open for any active user)
    new_business = Business(
        owner_id=current_user.id,
        business_name=payload.business_name.strip(),
        category=payload.category.strip(),
        location=payload.location.strip(),
        phone=payload.phone.strip(),
        whatsapp_number=payload.whatsapp_number.strip() if payload.whatsapp_number else None,
        opening_hours=payload.opening_hours.strip() if payload.opening_hours else None,
        payment_methods=payload.payment_methods.strip() if payload.payment_methods else None,
        delivery_options=payload.delivery_options.strip() if payload.delivery_options else None,
        description=payload.description.strip() if payload.description else None
    )
    db.add(new_business)
    db.commit()
    db.refresh(new_business)
    return new_business


@router.get("/", response_model=List[BusinessResponse])
def list_businesses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all businesses owned by the current user. Admins can view all businesses."""
    if current_user.role == "admin":
        return db.query(Business).all()
    return db.query(Business).filter(Business.owner_id == current_user.id).all()


@router.get("/{business_id}", response_model=BusinessResponse)
def get_business(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves details of a specific business profile. Validates owner permissions."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found"
        )
    
    # Check authorization
    if business.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this business profile"
        )
    
    return business


@router.put("/{business_id}", response_model=BusinessResponse)
def update_business(
    business_id: uuid.UUID,
    payload: BusinessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates a business profile. Only owner or admin permitted."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found"
        )
    
    # Check authorization
    if business.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this business profile"
        )
    
    # Update fields if provided
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if isinstance(value, str):
                value = value.strip()
            setattr(business, field, value)
            
    db.commit()
    db.refresh(business)
    return business


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a business profile and cascades to all child models. Only owner or admin permitted."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found"
        )
    
    # Check authorization
    if business.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this business profile"
        )
        
    db.delete(business)
    db.commit()
    return None


# --- Public API Router & Schemas ---

public_router = APIRouter(prefix="/public/businesses", tags=["public-businesses"])

class BusinessPublicResponse(BaseModel):
    business_name: str
    category: str
    location: str
    opening_hours: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


@public_router.get("/{business_id}", response_model=BusinessPublicResponse)
def get_public_business_profile(
    business_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Retrieves basic public details of a specific business profile. No auth required."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found"
        )
    return business

