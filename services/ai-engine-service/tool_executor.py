import httpx
import os
from typing import Dict, Any


class ToolExecutor:
    def __init__(self):
        self.tool_service_url = os.getenv("TOOL_SERVICE_URL", "http://tool-execution-service:3002")
    
    async def execute(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        agent_id: str
    ) -> Dict[str, Any]:
        """Execute a tool/function call"""
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.tool_service_url}/execute",
                    json={
                        "toolName": tool_name,
                        "parameters": parameters,
                        "agentId": agent_id
                    }
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    return {
                        "success": False,
                        "error": f"Tool execution failed: {response.status_code}"
                    }
        except Exception as e:
            print(f"Tool execution error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
