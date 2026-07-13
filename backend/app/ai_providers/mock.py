import hashlib
import random
import math
from typing import List
from app.ai_providers.base import BaseLLMProvider, BaseEmbeddingProvider

class MockLLMProvider(BaseLLMProvider):
    def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        if not system_prompt:
            return f"[MOCK] Hello! How can I help you today?"
            
        # Try to extract the business knowledge context
        if "BUSINESS KNOWLEDGE/CONTEXTS:" in system_prompt:
            try:
                # Extract the text between BUSINESS KNOWLEDGE/CONTEXTS: and CONVERSATION HISTORY:
                parts = system_prompt.split("BUSINESS KNOWLEDGE/CONTEXTS:")
                context_part = parts[1].split("CONVERSATION HISTORY:")[0].strip()
                
                # Find the first context source
                if "Context Source [1]:" in context_part:
                    source_block = context_part.split("Context Source [1]:")[1]
                    # split by next source if present
                    if "Context Source [2]:" in source_block:
                        source_block = source_block.split("Context Source [2]:")[0]
                    source_block = source_block.strip()
                    
                    # Split block into title and content lines
                    lines = source_block.split("\n")
                    title = lines[0].strip()
                    content_lines = lines[1:]
                    content_text = "\n".join(content_lines).strip()
                    
                    # If it's an FAQ, extract the Answer
                    if "Answer:" in content_text:
                        ans = content_text.split("Answer:", 1)[1].strip()
                        return ans
                        
                    # If it's a Product, format a nice sentence
                    if "Product:" in content_text:
                        name = title
                        price_line = [l for l in content_lines if "Price:" in l]
                        desc_line = [l for l in content_lines if "Description:" in l]
                        qty_line = [l for l in content_lines if "Quantity in Stock:" in l or "Quantity:" in l]
                        
                        price_val = price_line[0].split("Price:", 1)[1].strip() if price_line else ""
                        desc_val = desc_line[0].split("Description:", 1)[1].strip() if desc_line else ""
                        qty_val = qty_line[0].split("Quantity in Stock:", 1)[1].strip() if qty_line else ""
                        if not qty_val and qty_line:
                            qty_val = qty_line[0].split("Quantity:", 1)[1].strip()
                            
                        qty_str = f" In stock: {qty_val} items." if qty_val else ""
                        desc_str = f" {desc_val}" if desc_val else ""
                        
                        return f"We have '{name}' available for {price_val}.{desc_str}{qty_str}"
                        
                    # If it's a Service, format a nice sentence
                    if "Service:" in content_text:
                        name = title
                        price_line = [l for l in content_lines if "Price:" in l]
                        desc_line = [l for l in content_lines if "Description:" in l]
                        price_val = price_line[0].split("Price:", 1)[1].strip() if price_line else ""
                        desc_val = desc_line[0].split("Description:", 1)[1].strip() if desc_line else ""
                        
                        desc_str = f" {desc_val}" if desc_val else ""
                        return f"Our '{name}' service is available for {price_val}.{desc_str}"
                        
                    # If it is a generic text chunk, return it
                    return content_text
            except Exception as e:
                print(f"[Mock LLM Fallback Parsing Error] {e}")
        
        # If parsing failed or no context, return standard mock response
        snippet = prompt[:60] + "..." if len(prompt) > 60 else prompt
        return f"[MOCK AI RESPONSE] Received: '{snippet}'. Add Google Gemini API keys in your .env to run real models."


class MockEmbeddingProvider(BaseEmbeddingProvider):
    def _generate_vector(self, text: str) -> List[float]:
        import re
        import hashlib
        import random
        
        dim = 1536
        vector = [0.0] * dim
        
        # Tokenize alphanumeric words of length >= 2
        raw_words = re.findall(r'[a-zA-Z0-9]{2,}', text.lower())
        
        # Common English stop words to filter out
        stopwords = {
            "the", "and", "for", "you", "that", "this", "with", "have", "are", "was",
            "were", "but", "not", "she", "her", "his", "they", "them", "their", "our",
            "what", "where", "when", "how", "who", "which", "about", "your", "will", "can",
            "does", "did", "do", "in", "on", "at", "to", "of", "a", "an", "is"
        }
        
        # Simple plural suffix stripping
        words = []
        for w in raw_words:
            if w in stopwords:
                continue
            if w.endswith('s') and len(w) > 3 and not w.endswith('ss'):
                w = w[:-1]
            words.append(w)
        
        has_val = False
        for word in words:
            # Hash word to a deterministic index [0, 1535]
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % dim
            vector[idx] += 1.0
            has_val = True
            
        # If no keywords found, fallback to hash-based pseudo-random vector
        if not has_val:
            h_fallback = int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16)
            rng = random.Random(h_fallback)
            vector = [rng.uniform(-0.1, 0.1) for _ in range(dim)]
            
        # Normalize the vector (L2 norm)
        square_sum = sum(x * x for x in vector)
        norm = math.sqrt(square_sum)
        if norm > 0:
            vector = [x / norm for x in vector]
            
        return vector

    def embed_text(self, text: str) -> List[float]:
        return self._generate_vector(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(text) for text in texts]
