from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import asyncio

from voice_pipeline import VoicePipeline
from llm_processor import LLMProcessor
from tool_executor import ToolExecutor

load_dotenv()

app = FastAPI(title="AI Engine Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
voice_pipeline = VoicePipeline()
llm_processor = LLMProcessor()
tool_executor = ToolExecutor()


class ProcessCallRequest(BaseModel):
    callSid: str
    agentId: str


class ChatRequest(BaseModel):
    message: str
    agentId: str
    conversationId: str
    context: dict = {}


@app.post("/process-call")
async def process_call(request: ProcessCallRequest):
    """Start AI processing for a call"""
    try:
        # Get agent configuration
        agent_config = await get_agent_config(request.agentId)
        
        # Initialize voice pipeline
        await voice_pipeline.start_stream(
            call_sid=request.callSid,
            agent_config=agent_config
        )
        
        return {
            "success": True,
            "message": "Call processing started",
            "callSid": request.callSid
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(request: ChatRequest):
    """Process a chat message (for testing or text-based agents)"""
    try:
        agent_config = await get_agent_config(request.agentId)
        
        # Process through LLM
        response = await llm_processor.process(
            message=request.message,
            system_prompt=agent_config['systemPrompt'],
            tools=agent_config.get('tools', []),
            context=request.context
        )
        
        # Execute tools if needed
        if response.get('tool_calls'):
            tool_results = []
            for tool_call in response['tool_calls']:
                result = await tool_executor.execute(
                    tool_name=tool_call['name'],
                    parameters=tool_call['parameters'],
                    agent_id=request.agentId
                )
                tool_results.append(result)
            
            response['tool_results'] = tool_results
        
        return {
            "success": True,
            "data": response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/voice/speech-to-text")
async def speech_to_text(audio_data: bytes):
    """Convert speech to text using Deepgram"""
    try:
        text = await voice_pipeline.transcribe(audio_data)
        return {
            "success": True,
            "text": text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/voice/text-to-speech")
async def text_to_speech(text: str, voice: str = "default"):
    """Convert text to speech using ElevenLabs"""
    try:
        audio_data = await voice_pipeline.synthesize(text, voice)
        return {
            "success": True,
            "audio": audio_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {
        "success": True,
        "service": "ai-engine-service",
        "status": "healthy"
    }


async def get_agent_config(agent_id: str):
    """Fetch agent configuration from admin service"""
    import httpx
    
    admin_service_url = f"http://admin-service:{os.getenv('ADMIN_SERVICE_PORT', 3004)}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{admin_service_url}/agent/{agent_id}")
        
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return response.json()['data']


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AI_ENGINE_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
