import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Database (Create tables if they don't exist)
from app.database.base import Base
from app.database.session import engine
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS setup
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.auth.routes import router as auth_router
from app.businesses.routes import router as businesses_router, public_router as public_businesses_router
from app.products.routes import router as products_router
from app.services.routes import router as services_router
from app.faqs.routes import router as faqs_router
from app.documents.routes import router as documents_router
from app.ai_providers.routes import router as ai_router
from app.rag.routes import router as rag_router
from app.chat.routes import router as chat_router, dashboard_router as chat_dashboard_router
from app.chat.whatsapp_routes import router as whatsapp_router

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(businesses_router, prefix="/businesses", tags=["businesses"])
app.include_router(public_businesses_router)
app.include_router(products_router, tags=["products"])
app.include_router(services_router, tags=["services"])
app.include_router(faqs_router, tags=["faqs"])
app.include_router(documents_router, tags=["documents"])
app.include_router(ai_router)
app.include_router(rag_router)
app.include_router(chat_router)
app.include_router(chat_dashboard_router)
app.include_router(whatsapp_router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to the EasyBiz AI API. The backend server is running successfully.",
        "docs_url": "/docs"
    }

@app.get("/health")
async def health_check():
    ai_mode = os.getenv("AI_MODE", "mock")
    ai_status = f"mocked_{ai_mode}_ok" if ai_mode else "not_configured"
    
    # Real database connectivity check
    from app.database.session import SessionLocal
    try:
        db = SessionLocal()
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    finally:
        db.close()
    
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "ai_provider": ai_status,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
