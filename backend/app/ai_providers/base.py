from abc import ABC, abstractmethod
from typing import List

class BaseLLMProvider(ABC):
    """Common interface for local and API cloud LLM generators."""
    
    @abstractmethod
    def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        """Generates a text completion based on the given prompt and optional system context."""
        pass

class BaseEmbeddingProvider(ABC):
    """Common interface for local and API cloud Text Embeddings."""
    
    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Generates a numerical vector embedding for a single text input."""
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generates numerical vector embeddings for a batch of text inputs."""
        pass
