from typing import List, Optional
from app.ai_providers.factory import get_llm_provider, get_embedding_provider

class AIService:
    """Unified service class isolating all interactions with the configured active AI providers."""
    
    def __init__(self):
        self._llm_provider = get_llm_provider()
        self._embedding_provider = get_embedding_provider()

    def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generates a text completion response using the active LLM provider."""
        return self._llm_provider.generate_response(prompt=prompt, system_prompt=system_prompt)

    def embed_text(self, text: str) -> List[float]:
        """Generates vector float embeddings for a single text using the active Embedding provider."""
        return self._embedding_provider.embed_text(text=text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generates vector float embeddings in batch using the active Embedding provider."""
        return self._embedding_provider.embed_batch(texts=texts)

    @property
    def llm_mode(self) -> str:
        """Returns the class name of the active LLM provider."""
        return self._llm_provider.__class__.__name__

    @property
    def llm_model(self) -> str:
        """Returns the model identifier configured for the active LLM provider."""
        return getattr(self._llm_provider, "model", "mock-model")

    @property
    def embedding_mode(self) -> str:
        """Returns the class name of the active Embedding provider."""
        return self._embedding_provider.__class__.__name__

    @property
    def embedding_model(self) -> str:
        """Returns the model identifier configured for the active Embedding provider."""
        return getattr(self._embedding_provider, "model", "mock-model")
