from app.speech_providers.base import BaseSpeechToTextProvider

class LocalWhisperProvider(BaseSpeechToTextProvider):
    """Local Speech-to-Text provider using OpenAI Whisper or faster-whisper on CPU."""
    
    def __init__(self):
        self.model = None
        self.mode_type = None
        
    def _load_model(self):
        if self.model is not None:
            return
            
        try:
            from faster_whisper import WhisperModel
            print("[STT Local] Loading local faster-whisper model (base) on CPU...")
            self.model = WhisperModel("base", device="cpu", compute_type="int8")
            self.mode_type = "faster-whisper"
        except ImportError:
            try:
                import whisper
                print("[STT Local] Loading local openai-whisper model (base)...")
                self.model = whisper.load_model("base")
                self.mode_type = "openai-whisper"
            except ImportError:
                raise ImportError(
                    "Local Whisper Speech-To-Text requires either the 'faster-whisper' or "
                    "'openai-whisper' python package. Please install them or use STT_PROVIDER=mock."
                )

    def transcribe(self, audio_file_path: str) -> str:
        self._load_model()
        
        if self.mode_type == "faster-whisper":
            segments, info = self.model.transcribe(audio_file_path, beam_size=5)
            text = " ".join([segment.text for segment in segments])
            return text.strip()
        else:
            result = self.model.transcribe(audio_file_path)
            return result.get("text", "").strip()
