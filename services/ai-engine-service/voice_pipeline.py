import asyncio
from deepgram import Deepgram
import os
import httpx


class VoicePipeline:
    def __init__(self):
        self.deepgram_key = os.getenv("DEEPGRAM_API_KEY")
        self.elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")
        self.deepgram = Deepgram(self.deepgram_key) if self.deepgram_key else None
    
    async def start_stream(self, call_sid: str, agent_config: dict):
        """Start voice processing stream for a call"""
        print(f"Starting voice stream for call: {call_sid}")
        # Implementation for real-time voice streaming
        # This would connect to Deepgram/ElevenLabs streaming APIs
        pass
    
    async def transcribe(self, audio_data: bytes) -> str:
        """Convert speech to text using Deepgram"""
        if not self.deepgram:
            return "Deepgram not configured"
        
        try:
            response = await self.deepgram.transcription.prerecorded(
                {"buffer": audio_data, "mimetype": "audio/wav"},
                {"punctuate": True, "language": "en"}
            )
            
            transcript = response["results"]["channels"][0]["alternatives"][0]["transcript"]
            return transcript
        except Exception as e:
            print(f"Transcription error: {e}")
            raise
    
    async def synthesize(self, text: str, voice: str = "default") -> bytes:
        """Convert text to speech using ElevenLabs"""
        if not self.elevenlabs_key:
            return b""
        
        # Default voice ID (replace with actual voice IDs from ElevenLabs)
        voice_id = "21m00Tcm4TlvDq8ikWAM" if voice == "default" else voice
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "xi-api-key": self.elevenlabs_key,
            "Content-Type": "application/json"
        }
        
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=data)
                
                if response.status_code == 200:
                    return response.content
                else:
                    print(f"TTS error: {response.status_code}")
                    return b""
        except Exception as e:
            print(f"TTS error: {e}")
            raise
