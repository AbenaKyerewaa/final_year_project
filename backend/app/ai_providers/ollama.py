import requests
from typing import List, Optional
from app.ai_providers.base import BaseLLMProvider, BaseEmbeddingProvider

class OllamaLLMProvider(BaseLLMProvider):
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model
        
        # Test connection with short timeout to ensure service is reachable
        try:
            response = requests.get(f"{self.base_url}/", timeout=2.0)
            if response.status_code != 200:
                raise ConnectionError(f"Ollama server returned status code: {response.status_code}")
        except Exception as e:
            raise ConnectionError(f"Could not connect to Ollama server at {self.base_url}: {e}")

    def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        url = f"{self.base_url}/api/chat"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False
        }
        
        try:
            response = requests.post(url, json=payload, timeout=60.0)
            response.raise_for_status()
            data = response.json()
            return data["message"]["content"]
        except Exception as e:
            raise RuntimeError(f"Ollama generation request failed: {e}")


class OllamaEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model
        
        # Test connection
        try:
            requests.get(f"{self.base_url}/", timeout=2.0)
        except Exception as e:
            raise ConnectionError(f"Could not connect to Ollama server at {self.base_url}: {e}")

    def embed_text(self, text: str) -> List[float]:
        url = f"{self.base_url}/api/embeddings"
        payload = {
            "model": self.model,
            "prompt": text
        }
        
        try:
            response = requests.post(url, json=payload, timeout=15.0)
            response.raise_for_status()
            data = response.json()
            return data["embedding"]
        except Exception as e:
            raise RuntimeError(f"Ollama embedding request failed: {e}")

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        # Natively Ollama embeds one text per call; we loop through batch
        embeddings = []
        for text in texts:
            embeddings.append(self.embed_text(text))
        return embeddings
