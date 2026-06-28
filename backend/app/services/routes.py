import uuid
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.models import Service
from app.businesses.models import Business
from app.auth.models import User
from app.auth.security import get_current_user
from app.products.routes import verify_business_access

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
    return service


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: uuid.UUID,
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
    
    db.delete(service)
    db.commit()
    return None
