import os
from app.speech_providers.base import BaseSpeechToTextProvider

class MockSpeechToTextProvider(BaseSpeechToTextProvider):
    """Mock Speech-To-Text provider that returns static or pattern-matched transcriptions."""
    
    def transcribe(self, audio_file_path: str) -> str:
        filename = os.path.basename(audio_file_path).lower()
        
        # Test helper pattern matching on filename
        if "deliver" in filename:
            return "Do you deliver?"
        if "hours" in filename or "opening" in filename:
            return "What are your opening hours?"
        if "located" in filename or "location" in filename:
            return "Where are you located?"
            
        # Respect environment variable overrides if set
        env_override = os.getenv("MOCK_STT_TRANSCRIPTION")
        if env_override:
            return env_override.strip()
            
        return "Do you have HP laptops?"
