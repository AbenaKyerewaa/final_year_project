import os
from app.ai_providers.base import BaseLLMProvider, BaseEmbeddingProvider
from app.ai_providers.cloud_api import CloudLLMProvider, CloudEmbeddingProvider
from app.ai_providers.mock import MockLLMProvider, MockEmbeddingProvider

_cached_llm_provider = None
_cached_embedding_provider = None

def get_llm_provider() -> BaseLLMProvider:
    global _cached_llm_provider
    if _cached_llm_provider is not None:
        return _cached_llm_provider
        
    ai_mode = os.getenv("AI_MODE", "mock").strip().lower()
    
    if ai_mode == "api":
        provider = os.getenv("AI_API_PROVIDER", "gemini").strip().lower()
        api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("AI_API_KEY", "").strip()
        base_url = os.getenv("AI_API_BASE_URL", "").strip()
        model = os.getenv("AI_LLM_MODEL", "gemini-2.5-flash").strip()
        
        # Override default model based on selected provider if standard model not set
        if not os.getenv("AI_LLM_MODEL"):
            if provider == "gemini":
                model = "gemini-2.5-flash"
            elif provider == "openai":
                model = "gpt-4o-mini"
            elif provider == "groq":
                model = "llama3-8b-8192"
                
        if not api_key:
            print("[AI Factory WARNING] AI_MODE is set to 'api' but neither GEMINI_API_KEY nor AI_API_KEY is configured. Falling back to MockLLMProvider.")
            _cached_llm_provider = MockLLMProvider()
        else:
            print(f"[AI Factory] Loading cloud API LLM provider '{provider}' (Model: {model})...")
            _cached_llm_provider = CloudLLMProvider(
                provider=provider,
                api_key=api_key,
                base_url=base_url if base_url else None,
                model=model
            )
    else:
        print("[AI Factory] Loading fallback MockLLMProvider.")
        _cached_llm_provider = MockLLMProvider()
        
    return _cached_llm_provider


def get_embedding_provider() -> BaseEmbeddingProvider:
    global _cached_embedding_provider
    if _cached_embedding_provider is not None:
        return _cached_embedding_provider
        
    ai_mode = os.getenv("AI_MODE", "mock").strip().lower()
    
    if ai_mode == "api":
        provider = os.getenv("AI_API_PROVIDER", "gemini").strip().lower()
        api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("AI_API_KEY", "").strip()
        base_url = os.getenv("AI_API_BASE_URL", "").strip()
        model = os.getenv("AI_EMBED_MODEL", "gemini-embedding-001").strip()
        
        # Default embedding model based on provider if not overridden
        if not os.getenv("AI_EMBED_MODEL"):
            if provider == "gemini":
                model = "gemini-embedding-001"
            elif provider == "openai":
                model = "text-embedding-3-small"
            
        if not api_key:
            print("[AI Factory WARNING] AI_MODE is set to 'api' but neither GEMINI_API_KEY nor AI_API_KEY is configured. Falling back to MockEmbeddingProvider.")
            _cached_embedding_provider = MockEmbeddingProvider()
        else:
            print(f"[AI Factory] Loading cloud API Embedding provider '{provider}' (Model: {model})...")
            _cached_embedding_provider = CloudEmbeddingProvider(
                provider=provider,
                api_key=api_key,
                base_url=base_url if base_url else None,
                model=model
            )
    else:
        print("[AI Factory] Loading fallback MockEmbeddingProvider.")
        _cached_embedding_provider = MockEmbeddingProvider()
        
    return _cached_embedding_provider
