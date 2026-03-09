from datetime import datetime
from typing import Dict, Any
import httpx
import os


class KPICalculator:
    def __init__(self):
        self.admin_service_url = f"http://admin-service:{os.getenv('ADMIN_SERVICE_PORT', 3004)}"
    
    async def calculate_kpis(
        self,
        company_id: str,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """Calculate all KPIs for a company"""
        
        # Fetch call data
        calls = await self._fetch_calls(company_id, start_date, end_date)
        
        if not calls:
            return self._empty_kpis()
        
        total_calls = len(calls)
        completed_calls = [c for c in calls if c.get('status') == 'completed']
        failed_calls = [c for c in calls if c.get('status') in ['failed', 'no-answer', 'busy']]
        missed_calls = [c for c in calls if c.get('status') not in ['completed', 'failed', 'no-answer', 'busy', 'in-progress']]
        escalated_calls = [c for c in calls if c.get('escalated', False)]
        
        # Separate by direction
        inbound_calls = [c for c in calls if c.get('direction') == 'inbound']
        outbound_calls = [c for c in calls if c.get('direction') == 'outbound']
        
        # Calculate durations
        durations = [c.get('duration', 0) for c in completed_calls if c.get('duration')]
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        # Calculate success rate
        success_rate = (len(completed_calls) / total_calls * 100) if total_calls > 0 else 0
        
        # Calculate escalation rate
        escalation_rate = (len(escalated_calls) / total_calls * 100) if total_calls > 0 else 0
        
        # Calculate first call resolution (simplified)
        fcr_calls = [c for c in completed_calls if not c.get('escalated', False)]
        fcr_rate = (len(fcr_calls) / total_calls * 100) if total_calls > 0 else 0
        
        # Tool usage
        tool_calls = sum([len(c.get('tool_calls', [])) for c in calls])
        tool_success = sum([
            len([t for t in c.get('tool_calls', []) if t.get('success', False)])
            for c in calls
        ])
        tool_success_rate = (tool_success / tool_calls * 100) if tool_calls > 0 else 0
        
        # AI Performance Score (custom formula)
        ai_score = self._calculate_ai_score(
            success_rate=success_rate,
            escalation_rate=escalation_rate,
            tool_success_rate=tool_success_rate
        )
        
        return {
            "overview": {
                "totalCalls": total_calls,
                "inboundCalls": len(inbound_calls),
                "outboundCalls": len(outbound_calls),
                "completedCalls": len(completed_calls),
                "failedCalls": len(failed_calls),
                "missedCalls": len(missed_calls),
                "escalatedCalls": len(escalated_calls),
                "averageDuration": round(avg_duration, 2),
                "successRate": round(success_rate, 2),
                "escalationRate": round(escalation_rate, 2),
                "firstCallResolution": round(fcr_rate, 2)
            },
            "tools": {
                "totalToolCalls": tool_calls,
                "successfulToolCalls": tool_success,
                "toolSuccessRate": round(tool_success_rate, 2)
            },
            "aiPerformance": {
                "score": round(ai_score, 2),
                "rating": self._get_rating(ai_score)
            }
        }
    
    def _calculate_ai_score(
        self,
        success_rate: float,
        escalation_rate: float,
        tool_success_rate: float
    ) -> float:
        """Calculate AI Performance Score (0-100)"""
        
        # Weighted formula
        score = (
            success_rate * 0.4 +  # 40% weight on success
            (100 - escalation_rate) * 0.3 +  # 30% weight on not escalating
            tool_success_rate * 0.3  # 30% weight on tool success
        )
        
        return max(0, min(100, score))
    
    def _get_rating(self, score: float) -> str:
        """Convert score to rating"""
        if score >= 90:
            return "Excellent"
        elif score >= 75:
            return "Good"
        elif score >= 60:
            return "Fair"
        else:
            return "Needs Improvement"
    
    def _empty_kpis(self) -> Dict[str, Any]:
        """Return empty KPI structure"""
        return {
            "overview": {
                "totalCalls": 0,
                "inboundCalls": 0,
                "outboundCalls": 0,
                "completedCalls": 0,
                "failedCalls": 0,
                "missedCalls": 0,
                "escalatedCalls": 0,
                "averageDuration": 0,
                "successRate": 0,
                "escalationRate": 0,
                "firstCallResolution": 0
            },
            "tools": {
                "totalToolCalls": 0,
                "successfulToolCalls": 0,
                "toolSuccessRate": 0
            },
            "aiPerformance": {
                "score": 0,
                "rating": "No Data"
            }
        }
    
    async def _fetch_calls(self, company_id: str, start_date: str, end_date: str):
        """Fetch calls from admin service"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.admin_service_url}/call",
                    params={
                        "companyId": company_id,
                        "startDate": start_date,
                        "endDate": end_date,
                        "limit": 10000
                    }
                )
                
                if response.status_code == 200:
                    return response.json().get('data', {}).get('calls', [])
                return []
        except Exception as e:
            print(f"Error fetching calls: {e}")
            return []
