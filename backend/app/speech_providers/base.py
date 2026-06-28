from abc import ABC, abstractmethod

class BaseSpeechToTextProvider(ABC):
    """Common interface for Speech-to-Text transcriber providers."""
    
    @abstractmethod
    def transcribe(self, audio_file_path: str) -> str:
        """Transcribes the audio file at the given local file path and returns text.
        
        Args:
            audio_file_path (str): Absolute or relative path to the local audio file.
            
        Returns:
            str: Transcribed text output.
        """
        pass
