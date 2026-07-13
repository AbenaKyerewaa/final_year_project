import requests
from typing import List, Optional
from app.ai_providers.base import BaseLLMProvider, BaseEmbeddingProvider

from google import genai
from google.genai import types, errors

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
        
        # Setup Google Gen AI client for native Gemini routing
        self.client = None
        if self.provider == "gemini" and "generativelanguage.googleapis.com" in self.base_url:
            self.client = genai.Client(api_key=self.api_key)

    def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        # Native Gemini API routing via official SDK
        if self.client:
            # Check for empty prompt
            if not prompt or not prompt.strip():
                raise ValueError("Prompt cannot be empty.")
                
            import time
            retries = 6
            backoff = 1.0
            while retries > 0:
                try:
                    # Strip models/ prefix if present
                    model_name = self.model
                    if model_name.startswith("models/"):
                        model_name = model_name[7:]
                    
                    config = types.GenerateContentConfig(
                        system_instruction=system_prompt if system_prompt else None,
                        temperature=0.2
                    )
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=prompt.strip(),
                        config=config
                    )
                    if not response or not response.text:
                        raise RuntimeError("Gemini returned an empty response.")
                    return response.text
                except errors.APIError as e:
                    err_msg = str(e).lower()
                    # If it is a permanent quota limit or billing error, fail immediately
                    if any(k in err_msg for k in ["quota", "billing", "plan"]):
                        if e.code == 429:
                            raise RuntimeError(f"Gemini API quota exceeded or rate limited: {e.message}")
                        raise e
                    # Retry on 503, 429, or 500 transient errors
                    if e.code in [429, 503, 500] and retries > 1:
                        sleep_time = 6.0 if e.code == 429 else backoff
                        print(f"[Gemini LLM] Transient API error {e.code}. Retrying in {sleep_time}s...")
                        time.sleep(sleep_time)
                        retries -= 1
                        backoff *= 2
                        continue
                    if e.code == 400:
                        raise ValueError(f"Malformed request or empty prompt sent to Gemini: {e.message}")
                    elif e.code == 403:
                        raise PermissionError(f"Invalid API key or permission denied for Gemini API: {e.message}")
                    elif e.code == 429:
                        raise RuntimeError(f"Gemini API quota exceeded or rate limited: {e.message}")
                    else:
                        raise RuntimeError(f"Gemini API error (Status {e.code}): {e.message}")
                except Exception as e:
                    err_msg = str(e).lower()
                    if any(k in err_msg for k in ["quota", "billing", "plan"]):
                        raise e
                    if any(k in err_msg for k in ["rate limit", "429", "resource exhausted"]) and retries > 1:
                        print(f"[Gemini LLM] Rate limit exception. Retrying in 6.0s...")
                        time.sleep(6.0)
                        retries -= 1
                        backoff *= 2
                        continue
                    if retries > 1:
                        print(f"[Gemini LLM] Exception encountered: {str(e)}. Retrying in {backoff}s...")
                        time.sleep(backoff)
                        retries -= 1
                        backoff *= 2
                        continue
                    raise RuntimeError(f"Gemini API network or timeout error: {e}")
                
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

        # Setup Google Gen AI client for native Gemini routing
        self.client = None
        if self.provider == "gemini" and "generativelanguage.googleapis.com" in self.base_url:
            self.client = genai.Client(api_key=self.api_key)

    def embed_text(self, text: str) -> List[float]:
        # Native Gemini API routing via official SDK
        if self.client:
            if not text or not text.strip():
                raise ValueError("Text to embed cannot be empty.")
            try:
                # Strip models/ prefix if present
                model_name = self.model
                if model_name.startswith("models/"):
                    model_name = model_name[7:]
                
                response = self.client.models.embed_content(
                    model=model_name,
                    contents=text.strip()
                )
                return response.embeddings[0].values
            except errors.APIError as e:
                if e.code == 403:
                    raise PermissionError(f"Invalid API key or permission denied for Gemini Embedding: {e.message}")
                elif e.code == 429:
                    raise RuntimeError(f"Gemini Embedding API quota exceeded or rate limited: {e.message}")
                else:
                    raise RuntimeError(f"Gemini Embedding API error (Status {e.code}): {e.message}")
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
            
        # Native Gemini API routing via official SDK
        if self.client:
            try:
                # Strip models/ prefix if present
                model_name = self.model
                if model_name.startswith("models/"):
                    model_name = model_name[7:]
                
                formatted_contents = [types.Content(parts=[types.Part(text=t.strip())]) for t in texts if t and t.strip()]
                if not formatted_contents:
                    return []
                
                # Chunk requests to stay below Gemini 100-request batch size limit
                import time
                embeddings = []
                chunk_size = 90
                for i in range(0, len(formatted_contents), chunk_size):
                    chunk = formatted_contents[i:i + chunk_size]
                    retries = 3
                    while retries > 0:
                        try:
                            response = self.client.models.embed_content(
                                model=model_name,
                                contents=chunk
                            )
                            embeddings.extend([emb.values for emb in response.embeddings])
                            break
                        except errors.APIError as e:
                            if e.code == 429 and retries > 1:
                                print(f"[Gemini Embeddings] Rate limited (429). Sleeping for 35 seconds...")
                                time.sleep(35)
                                retries -= 1
                            else:
                                raise e
                return embeddings
            except errors.APIError as e:
                if e.code == 403:
                    raise PermissionError(f"Invalid API key or permission denied for Gemini Embedding: {e.message}")
                elif e.code == 429:
                    raise RuntimeError(f"Gemini Embedding API quota exceeded or rate limited: {e.message}")
                else:
                    raise RuntimeError(f"Gemini Embedding API error (Status {e.code}): {e.message}")
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
