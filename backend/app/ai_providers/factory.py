import os
from app.ai_providers.base import BaseLLMProvider, BaseEmbeddingProvider
from app.ai_providers.ollama import OllamaLLMProvider, OllamaEmbeddingProvider
from app.ai_providers.cloud_api import CloudLLMProvider, CloudEmbeddingProvider
from app.ai_providers.mock import MockLLMProvider, MockEmbeddingProvider

def get_llm_provider() -> BaseLLMProvider:
    ai_mode = os.getenv("AI_MODE", "mock").strip().lower()
    
    if ai_mode == "local":
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
        model = os.getenv("OLLAMA_LLM_MODEL", "mistral").strip()
        
        try:
            print(f"[AI Factory] Loading local Ollama LLM provider (Model: {model}) at {base_url}...")
            return OllamaLLMProvider(base_url=base_url, model=model)
        except Exception as e:
            print(f"[AI Factory WARNING] Failed to connect to Ollama LLM: {e}. Falling back to MockLLMProvider.")
            return MockLLMProvider()
            
    elif ai_mode == "api":
        provider = os.getenv("AI_API_PROVIDER", "openai").strip().lower()
        api_key = os.getenv("AI_API_KEY", "").strip()
        base_url = os.getenv("AI_API_BASE_URL", "").strip()
        model = os.getenv("AI_LLM_MODEL", "gpt-4o-mini").strip()
        
        # Override default model based on selected provider if standard model not set
        if not os.getenv("AI_LLM_MODEL"):
            if provider == "gemini":
                model = "gemini-1.5-flash"
            elif provider == "groq":
                model = "llama3-8b-8192"
                
        if not api_key:
            print("[AI Factory WARNING] AI_MODE is set to 'api' but AI_API_KEY is empty. Falling back to MockLLMProvider.")
            return MockLLMProvider()
            
        print(f"[AI Factory] Loading cloud API LLM provider '{provider}' (Model: {model})...")
        return CloudLLMProvider(
            provider=provider,
            api_key=api_key,
            base_url=base_url if base_url else None,
            model=model
        )
        
    else:
        print("[AI Factory] Loading fallback MockLLMProvider.")
        return MockLLMProvider()


def get_embedding_provider() -> BaseEmbeddingProvider:
    ai_mode = os.getenv("AI_MODE", "mock").strip().lower()
    
    if ai_mode == "local":
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
        model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text").strip()
        
        try:
            print(f"[AI Factory] Loading local Ollama Embedding provider (Model: {model}) at {base_url}...")
            return OllamaEmbeddingProvider(base_url=base_url, model=model)
        except Exception as e:
            print(f"[AI Factory WARNING] Failed to connect to Ollama Embedding: {e}. Falling back to MockEmbeddingProvider.")
            return MockEmbeddingProvider()
            
    elif ai_mode == "api":
        provider = os.getenv("AI_API_PROVIDER", "openai").strip().lower()
        api_key = os.getenv("AI_API_KEY", "").strip()
        base_url = os.getenv("AI_API_BASE_URL", "").strip()
        model = os.getenv("AI_EMBED_MODEL", "text-embedding-3-small").strip()
        
        # Default Gemini embedding model if not overridden
        if not os.getenv("AI_EMBED_MODEL") and provider == "gemini":
            model = "text-embedding-004"
            
        if not api_key:
            print("[AI Factory WARNING] AI_MODE is set to 'api' but AI_API_KEY is empty. Falling back to MockEmbeddingProvider.")
            return MockEmbeddingProvider()
            
        print(f"[AI Factory] Loading cloud API Embedding provider '{provider}' (Model: {model})...")
        return CloudEmbeddingProvider(
            provider=provider,
            api_key=api_key,
            base_url=base_url if base_url else None,
            model=model
        )
        
    else:
        print("[AI Factory] Loading fallback MockEmbeddingProvider.")
        return MockEmbeddingProvider()
