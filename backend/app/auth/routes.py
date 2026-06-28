import re
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.auth.models import User
from app.auth.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()

# --- Pydantic Schemas (Pydantic v2 compatible) ---

class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str
    password: str = Field(..., min_length=6, max_length=100)
    role: str = Field("business_owner", max_length=50)

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Email validator regex to avoid external dependency issues
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

def is_valid_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email))


# --- API Routes ---

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Registers a new business owner or staff user."""
    email = payload.email.strip().lower()
    
    # 1. Validate email format
    if not is_valid_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
        
    # 2. Validate role
    role = payload.role.strip().lower()
    if role not in ["admin", "business_owner", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user role. Allowed roles: admin, business_owner, staff"
        )
        
    # 3. Check for duplicates
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
        
    # 4. Create and commit User
    new_user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticates user and issues access token."""
    email = payload.email.strip().lower()
    
    # 1. Check user exists
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
        
    # 2. Verify password hash
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
        
    # 3. Generate token
    token_data = {"sub": str(user.id), "role": user.role}
    access_token = create_access_token(data=token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns profile of the active logged-in user."""
    return current_user


@router.post("/logout")
def logout():
    """Stateless placeholder endpoint for logging out."""
    return {"message": "Logged out successfully"}
