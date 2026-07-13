import os
from app.speech_providers.base import BaseSpeechToTextProvider
from app.speech_providers.mock import MockSpeechToTextProvider
from app.speech_providers.local import LocalWhisperProvider
from app.speech_providers.api import APISpeechToTextProvider

_cached_stt_provider = None

def get_stt_provider() -> BaseSpeechToTextProvider:
    """Returns the Speech-to-Text provider resolved from environment configurations."""
    global _cached_stt_provider
    if _cached_stt_provider is not None:
        return _cached_stt_provider
        
    stt_provider = os.getenv("STT_PROVIDER")
    
    # If STT_PROVIDER is not explicitly set, fallback to mapping from AI_MODE
    if not stt_provider:
        ai_mode = os.getenv("AI_MODE", "mock").strip().lower()
        if ai_mode == "api":
            stt_provider = "api"
        else:
            stt_provider = "mock"
            
    stt_provider = stt_provider.strip().lower()
    
    if stt_provider == "local":
        try:
            print("[STT Factory] Initializing LocalWhisperProvider...")
            _cached_stt_provider = LocalWhisperProvider()
        except Exception as e:
            print(f"[STT Factory WARNING] Failed to initialize local whisper: {e}. Falling back to Mock Speech provider.")
            _cached_stt_provider = MockSpeechToTextProvider()
            
    elif stt_provider == "api":
        api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("AI_API_KEY", "").strip()
        base_url = os.getenv("AI_API_BASE_URL", "").strip()
        
        if not api_key:
            print("[STT Factory WARNING] STT_PROVIDER is 'api' but neither GEMINI_API_KEY nor AI_API_KEY is configured. Falling back to Mock Speech provider.")
            _cached_stt_provider = MockSpeechToTextProvider()
        else:
            print("[STT Factory] Initializing APISpeechToTextProvider...")
            _cached_stt_provider = APISpeechToTextProvider(api_key=api_key, base_url=base_url)
        
    else:
        print("[STT Factory] Initializing MockSpeechToTextProvider...")
        _cached_stt_provider = MockSpeechToTextProvider()
        
    return _cached_stt_provider
