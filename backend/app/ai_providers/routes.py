from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Union
from app.ai_providers import get_llm_provider, get_embedding_provider

router = APIRouter(prefix="/ai", tags=["ai"])

# --- Pydantic Schemas ---

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="The prompt input for generation")
    system_prompt: Optional[str] = Field(None, description="Optional system role prompt instructions")

class GenerateResponse(BaseModel):
    response: str
    mode: str
    model: str

class EmbedRequest(BaseModel):
    text: Optional[str] = Field(None, description="Single text input to embed")
    texts: Optional[List[str]] = Field(None, description="List of text inputs to embed in batch")

class EmbedResponse(BaseModel):
    embedding: Union[List[float], List[List[float]]]
    mode: str
    model: str
    dimension: int


# --- API Routes ---

@router.post("/test-generate", response_model=GenerateResponse)
def test_generate(payload: GenerateRequest):
    """Generates a text completion response using the configured active LLM provider."""
    try:
        provider = get_llm_provider()
        mode_name = provider.__class__.__name__
        model_name = getattr(provider, "model", "mock-model")
        
        response = provider.generate_response(
            prompt=payload.prompt,
            system_prompt=payload.system_prompt
        )
        
        return GenerateResponse(
            response=response,
            mode=mode_name,
            model=model_name
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI generation test route encountered an error: {str(e)}"
        )


@router.post("/test-embed", response_model=EmbedResponse)
def test_embed(payload: EmbedRequest):
    """Generates vector float embeddings using the configured active Embedding provider."""
    if not payload.text and not payload.texts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'text' or 'texts' in payload."
        )
        
    try:
        provider = get_embedding_provider()
        mode_name = provider.__class__.__name__
        model_name = getattr(provider, "model", "mock-model")
        
        if payload.texts is not None:
            # Batch embedding
            embeddings = provider.embed_batch(payload.texts)
            dim = len(embeddings[0]) if embeddings else 0
            return EmbedResponse(
                embedding=embeddings,
                mode=mode_name,
                model=model_name,
                dimension=dim
            )
        else:
            # Single embedding
            embedding = provider.embed_text(payload.text)
            dim = len(embedding)
            return EmbedResponse(
                embedding=embedding,
                mode=mode_name,
                model=model_name,
                dimension=dim
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI embedding test route encountered an error: {str(e)}"
        )
