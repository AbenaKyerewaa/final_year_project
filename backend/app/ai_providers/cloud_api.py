import requests
from typing import List, Optional
from app.ai_providers.base import BaseLLMProvider, BaseEmbeddingProvider

class CloudLLMProvider(BaseLLMProvider):
    def __init__(self, provider: str, api_key: str, base_url: Optional[str], model: str):
        self.provider = provider.lower()
        self.api_key = api_key
        self.model = model
        
        # Determine base URL based on provider
        if base_url:
            self.base_url = base_url.rstrip("/")
        else:
            if self.provider == "openai":
                self.base_url = "https://api.openai.com/v1"
            elif self.provider == "groq":
                self.base_url = "https://api.groq.com/openai/v1"
            elif self.provider == "openrouter":
                self.base_url = "https://openrouter.ai/api/v1"
            elif self.provider == "gemini":
                self.base_url = "https://generativelanguage.googleapis.com/v1beta"
            else:
                self.base_url = "https://api.openai.com/v1" # fallback

    def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        # Native Gemini API routing
        if self.provider == "gemini" and "generativelanguage.googleapis.com" in self.base_url:
            url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
            
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}]
                    }
                ]
            }
            if system_prompt:
                payload["systemInstruction"] = {
                    "parts": [{"text": system_prompt}]
                }
                
            try:
                response = requests.post(url, json=payload, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                raise RuntimeError(f"Gemini API generation failed: {e}")
                
        # OpenAI & OpenAI-compatible (Groq, OpenRouter, Gemini-compatible) routing
        else:
            url = f"{self.base_url}/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.2
            }
            
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except Exception as e:
                raise RuntimeError(f"Cloud API LLM request failed: {e}")


class CloudEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, provider: str, api_key: str, base_url: Optional[str], model: str):
        self.provider = provider.lower()
        self.api_key = api_key
        self.model = model
        
        # Determine base URL based on provider
        if base_url:
            self.base_url = base_url.rstrip("/")
        else:
            if self.provider == "openai":
                self.base_url = "https://api.openai.com/v1"
            elif self.provider == "gemini":
                self.base_url = "https://generativelanguage.googleapis.com/v1beta"
            else:
                self.base_url = "https://api.openai.com/v1"

    def embed_text(self, text: str) -> List[float]:
        # Native Gemini API routing
        if self.provider == "gemini" and "generativelanguage.googleapis.com" in self.base_url:
            # Note: Gemini model name in URL should start with models/
            model_name = self.model if self.model.startswith("models/") else f"models/{self.model}"
            url = f"{self.base_url}/{model_name}:embedContent?key={self.api_key}"
            
            payload = {
                "content": {
                    "parts": [{"text": text}]
                }
            }
            
            try:
                response = requests.post(url, json=payload, timeout=15.0)
                response.raise_for_status()
                data = response.json()
                return data["embedding"]["values"]
            except Exception as e:
                raise RuntimeError(f"Gemini embedding API failed: {e}")
                
        # OpenAI & OpenAI-compatible routing
        else:
            url = f"{self.base_url}/embeddings"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": self.model,
                "input": text
            }
            
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=15.0)
                response.raise_for_status()
                data = response.json()
                return data["data"][0]["embedding"]
            except Exception as e:
                raise RuntimeError(f"Cloud API embedding request failed: {e}")

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
            
        # Native Gemini API routing
        if self.provider == "gemini" and "generativelanguage.googleapis.com" in self.base_url:
            model_name = self.model if self.model.startswith("models/") else f"models/{self.model}"
            url = f"{self.base_url}/{model_name}:batchEmbedContents?key={self.api_key}"
            
            payload = {
                "requests": [
                    {
                        "model": model_name,
                        "content": {"parts": [{"text": t}]}
                    } for t in texts
                ]
            }
            
            try:
                response = requests.post(url, json=payload, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                return [emb["values"] for emb in data["embeddings"]]
            except Exception as e:
                raise RuntimeError(f"Gemini batch embedding API failed: {e}")
                
        # OpenAI & OpenAI-compatible routing
        else:
            url = f"{self.base_url}/embeddings"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": self.model,
                "input": texts
            }
            
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                # Sort data by index to guarantee input-output mapping matches
                sorted_data = sorted(data["data"], key=lambda x: x["index"])
                return [item["embedding"] for item in sorted_data]
            except Exception as e:
                raise RuntimeError(f"Cloud API batch embedding request failed: {e}")
