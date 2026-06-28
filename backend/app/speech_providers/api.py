import os
import requests
from app.speech_providers.base import BaseSpeechToTextProvider

class APISpeechToTextProvider(BaseSpeechToTextProvider):
    """Cloud API Speech-to-Text provider invoking OpenAI's Whisper transcription API."""
    
    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or os.getenv("AI_API_KEY", "").strip()
        self.base_url = base_url or os.getenv("AI_API_BASE_URL", "").strip() or "https://api.openai.com/v1"
        
    def transcribe(self, audio_file_path: str) -> str:
        if not self.api_key:
            raise ValueError("API-based Speech-To-Text requires AI_API_KEY. Please verify your environment config.")
            
        url = f"{self.base_url}/audio/transcriptions"
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }
        
        filename = os.path.basename(audio_file_path)
        # Determine appropriate content type based on extension
        content_type = "audio/webm"
        if filename.endswith(".wav"):
            content_type = "audio/wav"
        elif filename.endswith(".mp3"):
            content_type = "audio/mpeg"
        elif filename.endswith(".m4a"):
            content_type = "audio/mp4"
            
        with open(audio_file_path, "rb") as f:
            files = {
                "file": (filename, f, content_type)
            }
            data = {
                "model": "whisper-1"
            }
            
            print(f"[STT API] Posting audio file '{filename}' to {url}...")
            response = requests.post(url, headers=headers, files=files, data=data)
            
        if response.status_code != 200:
            error_msg = f"API STT transcription request failed (Status {response.status_code}): {response.text}"
            print(f"[STT API ERROR] {error_msg}")
            raise Exception(error_msg)
            
        result_json = response.json()
        return result_json.get("text", "").strip()
