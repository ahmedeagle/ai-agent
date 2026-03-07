import openai
import os
import json
import httpx
from typing import List, Dict, Any, Optional

openai.api_key = os.getenv("OPENAI_API_KEY")

ADMIN_SERVICE_URL = os.getenv("ADMIN_SERVICE_URL", "http://localhost:3001")


class LLMProcessor:
    def __init__(self):
        self.model = "gpt-4-turbo-preview"
        self.client = openai.AsyncOpenAI()
        self._tools_cache: Dict[str, List[Dict]] = {}  # companyId -> tools
    
    async def process(
        self,
        message: str,
        system_prompt: str,
        tools: List[str] = [],
        context: Dict[str, Any] = {},
        conversation_history: List[Dict] = []
    ) -> Dict[str, Any]:
        """Process a message through the LLM"""
        
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add conversation history
        messages.extend(conversation_history)
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Prepare tools for function calling
        tools_config = self._prepare_tools(tools) if tools else None
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools_config,
                tool_choice="auto" if tools_config else None,
                temperature=0.7,
                max_tokens=1000
            )
            
            message_response = response.choices[0].message
            
            result = {
                "text": message_response.content,
                "role": "assistant"
            }
            
            # Extract tool calls if any
            if message_response.tool_calls:
                result["tool_calls"] = [
                    {
                        "id": tool_call.id,
                        "name": tool_call.function.name,
                        "parameters": json.loads(tool_call.function.arguments)
                    }
                    for tool_call in message_response.tool_calls
                ]
            
            return result
            
        except Exception as e:
            print(f"LLM processing error: {e}")
            raise
    
    def _prepare_tools(self, tool_names: List[str]) -> List[Dict]:
        """Convert tool names to OpenAI function calling format"""

        # Built-in fallback tool definitions
        builtin_tools = {
            "getPatientInfo": {
                "type": "function",
                "function": {
                    "name": "getPatientInfo",
                    "description": "Retrieve patient information from the database",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "patient_id": {"type": "string", "description": "The unique patient identifier"}
                        },
                        "required": ["patient_id"]
                    }
                }
            },
            "createAppointment": {
                "type": "function",
                "function": {
                    "name": "createAppointment",
                    "description": "Schedule a new appointment",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "patient_id": {"type": "string", "description": "Patient ID"},
                            "datetime": {"type": "string", "description": "Appointment date and time (ISO format)"},
                            "type": {"type": "string", "description": "Appointment type"}
                        },
                        "required": ["patient_id", "datetime", "type"]
                    }
                }
            },
            "cancelOrder": {
                "type": "function",
                "function": {
                    "name": "cancelOrder",
                    "description": "Cancel an existing order",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "order_id": {"type": "string", "description": "Order ID to cancel"}
                        },
                        "required": ["order_id"]
                    }
                }
            },
            "createTicket": {
                "type": "function",
                "function": {
                    "name": "createTicket",
                    "description": "Create a support ticket",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Ticket title"},
                            "description": {"type": "string", "description": "Detailed description"},
                            "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "Ticket priority"}
                        },
                        "required": ["title", "description"]
                    }
                }
            },
            "scheduleCallback": {
                "type": "function",
                "function": {
                    "name": "scheduleCallback",
                    "description": "Schedule a callback for the customer",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "phone_number": {"type": "string", "description": "Customer phone number"},
                            "datetime": {"type": "string", "description": "Callback date and time (ISO format)"},
                            "notes": {"type": "string", "description": "Additional notes"}
                        },
                        "required": ["phone_number", "datetime"]
                    }
                }
            }
        }

        # Merge dynamic DB tools with builtins  
        all_tools = {**builtin_tools}

        # Add any cached DB tools
        for company_tools in self._tools_cache.values():
            for tool in company_tools:
                all_tools[tool["name"]] = {
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": tool.get("parameters", {"type": "object", "properties": {}})
                    }
                }

        return [all_tools[name] for name in tool_names if name in all_tools]

    async def fetch_company_tools(self, company_id: str) -> List[Dict]:
        """Fetch tools from database for a company and cache them"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ADMIN_SERVICE_URL}/tools",
                    params={"companyId": company_id},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    tools = data.get("data", [])
                    self._tools_cache[company_id] = [
                        {
                            "name": t["name"],
                            "description": t.get("description", ""),
                            "parameters": t.get("parameters", {}),
                            "endpoint": t.get("endpoint", ""),
                            "method": t.get("method", "POST")
                        }
                        for t in tools if t.get("active", True)
                    ]
                    return self._tools_cache[company_id]
        except Exception as e:
            print(f"Error fetching company tools: {e}")
        return []
    
    async def stream_process(self, message: str, system_prompt: str):
        """Stream LLM response for real-time processing"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
