import os
from app.speech_providers.base import BaseSpeechToTextProvider
from app.speech_providers.mock import MockSpeechToTextProvider
from app.speech_providers.local import LocalWhisperProvider
from app.speech_providers.api import APISpeechToTextProvider

def get_stt_provider() -> BaseSpeechToTextProvider:
    """Returns the Speech-to-Text provider resolved from environment configurations."""
    stt_provider = os.getenv("STT_PROVIDER")
    
    # If STT_PROVIDER is not explicitly set, fallback to mapping from AI_MODE
    if not stt_provider:
        ai_mode = os.getenv("AI_MODE", "mock").strip().lower()
        if ai_mode == "local":
            stt_provider = "local"
        elif ai_mode == "api":
            stt_provider = "api"
        else:
            stt_provider = "mock"
            
    stt_provider = stt_provider.strip().lower()
    
    if stt_provider == "local":
        try:
            print("[STT Factory] Initializing LocalWhisperProvider...")
            return LocalWhisperProvider()
        except Exception as e:
            print(f"[STT Factory WARNING] Failed to initialize local whisper: {e}. Falling back to Mock Speech provider.")
            return MockSpeechToTextProvider()
            
    elif stt_provider == "api":
        api_key = os.getenv("AI_API_KEY", "").strip()
        base_url = os.getenv("AI_API_BASE_URL", "").strip()
        
        if not api_key:
            print("[STT Factory WARNING] STT_PROVIDER is 'api' but AI_API_KEY is empty. Falling back to Mock Speech provider.")
            return MockSpeechToTextProvider()
            
        print("[STT Factory] Initializing APISpeechToTextProvider...")
        return APISpeechToTextProvider(api_key=api_key, base_url=base_url)
        
    else:
        print("[STT Factory] Initializing MockSpeechToTextProvider...")
        return MockSpeechToTextProvider()
