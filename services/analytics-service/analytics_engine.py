from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import httpx
import os


class AnalyticsEngine:
    def __init__(self):
        self.admin_service_url = f"http://admin-service:{os.getenv('ADMIN_SERVICE_PORT', 3004)}"

    async def _fetch_calls(self, company_id: str, start_date: str = None, end_date: str = None, limit: int = 10000) -> list:
        """Fetch call data from admin-service"""
        try:
            params: Dict[str, Any] = {"companyId": company_id, "limit": limit}
            if start_date:
                params["startDate"] = start_date
            if end_date:
                params["endDate"] = end_date
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(f"{self.admin_service_url}/call", params=params)
                if response.status_code == 200:
                    return response.json().get("data", {}).get("calls", [])
                return []
        except Exception as e:
            print(f"Error fetching calls for analytics: {e}")
            return []

    async def _fetch_agents(self, company_id: str) -> list:
        """Fetch agents from admin-service"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.admin_service_url}/agent",
                    params={"companyId": company_id}
                )
                if response.status_code == 200:
                    return response.json().get("data", [])
                return []
        except Exception as e:
            print(f"Error fetching agents for analytics: {e}")
            return []

    async def get_call_analytics(
        self,
        company_id: str,
        time_range: str,
        group_by: str
    ) -> Dict[str, Any]:
        """Get call volume analytics grouped by time — fetches real data"""

        days = self._parse_time_range(time_range)
        start_date = (datetime.now() - timedelta(days=days)).isoformat()
        end_date = datetime.now().isoformat()

        calls = await self._fetch_calls(company_id, start_date, end_date)

        # Build a date -> stats map
        date_stats: Dict[str, Dict[str, int]] = {}
        current = datetime.now()
        for i in range(days):
            date = current - timedelta(days=i)
            key = date.strftime("%Y-%m-%d")
            date_stats[key] = {
                "totalCalls": 0,
                "inboundCalls": 0,
                "outboundCalls": 0,
                "completedCalls": 0,
                "failedCalls": 0
            }

        # Populate from real calls
        for call in calls:
            created = call.get("createdAt") or call.get("startTime")
            if not created:
                continue
            try:
                if isinstance(created, str):
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                else:
                    dt = created
                key = dt.strftime("%Y-%m-%d")
            except Exception:
                continue

            if key not in date_stats:
                date_stats[key] = {
                    "totalCalls": 0,
                    "inboundCalls": 0,
                    "outboundCalls": 0,
                    "completedCalls": 0,
                    "failedCalls": 0
                }
            date_stats[key]["totalCalls"] += 1
            direction = call.get("direction", "")
            if direction == "inbound":
                date_stats[key]["inboundCalls"] += 1
            elif direction == "outbound":
                date_stats[key]["outboundCalls"] += 1
            status = call.get("status", "")
            if status == "completed":
                date_stats[key]["completedCalls"] += 1
            elif status in ("failed", "no-answer", "busy"):
                date_stats[key]["failedCalls"] += 1

        data_points = []
        for key in sorted(date_stats.keys()):
            data_points.append({"date": key, **date_stats[key]})

        return {
            "timeRange": time_range,
            "groupBy": group_by,
            "dataPoints": data_points
        }

    async def get_agent_performance(
        self,
        company_id: str,
        agent_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get real agent performance metrics from call data"""

        agents = await self._fetch_agents(company_id)
        calls = await self._fetch_calls(company_id)

        # Group calls by agentId
        agent_calls: Dict[str, list] = {}
        for call in calls:
            aid = call.get("agentId")
            if aid:
                agent_calls.setdefault(aid, []).append(call)

        results = []
        for agent in agents:
            aid = agent.get("id")
            if agent_id and aid != agent_id:
                continue
            acalls = agent_calls.get(aid, [])
            total = len(acalls)
            completed = sum(1 for c in acalls if c.get("status") == "completed")
            escalated = sum(1 for c in acalls if c.get("escalated"))
            durations = [c.get("duration", 0) for c in acalls if c.get("duration")]
            avg_dur = sum(durations) / len(durations) if durations else 0

            escalation_rate = (escalated / total * 100) if total > 0 else 0
            success_rate = (completed / total * 100) if total > 0 else 0
            perf_score = success_rate * 0.6 + (100 - escalation_rate) * 0.4

            results.append({
                "agentId": aid,
                "agentName": agent.get("name", "Unknown"),
                "totalCalls": total,
                "completedCalls": completed,
                "avgDuration": round(avg_dur, 1),
                "escalationRate": round(escalation_rate, 1),
                "successRate": round(success_rate, 1),
                "performanceScore": round(perf_score, 1)
            })

        return results

    async def get_tool_usage(
        self,
        company_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get real tool usage stats from call data"""

        calls = await self._fetch_calls(company_id, start_date, end_date)

        tool_stats: Dict[str, Dict[str, int]] = {}
        for call in calls:
            tool_calls = call.get("toolCalls") or []
            for tc in tool_calls:
                name = tc.get("toolName") or tc.get("name", "unknown")
                if name not in tool_stats:
                    tool_stats[name] = {"total": 0, "success": 0, "failed": 0}
                tool_stats[name]["total"] += 1
                if tc.get("success", False) or tc.get("status") == "success":
                    tool_stats[name]["success"] += 1
                else:
                    tool_stats[name]["failed"] += 1

        results = []
        for name, stats in tool_stats.items():
            results.append({
                "toolName": name,
                "totalCalls": stats["total"],
                "successfulCalls": stats["success"],
                "failedCalls": stats["failed"],
                "successRate": round(stats["success"] / stats["total"] * 100, 1) if stats["total"] > 0 else 0
            })

        return results

    async def get_trends(
        self,
        company_id: str,
        metric: str
    ) -> Dict[str, Any]:
        """Get real trending data — compares current period vs previous"""

        now = datetime.now()
        current_start = (now - timedelta(days=7)).isoformat()
        previous_start = (now - timedelta(days=14)).isoformat()
        previous_end = (now - timedelta(days=7)).isoformat()

        current_calls = await self._fetch_calls(company_id, current_start, now.isoformat())
        previous_calls = await self._fetch_calls(company_id, previous_start, previous_end)

        def calc_metric(calls_list, m):
            total = len(calls_list)
            if m == "calls":
                return total
            elif m == "duration":
                durations = [c.get("duration", 0) for c in calls_list if c.get("duration")]
                return round(sum(durations) / len(durations), 1) if durations else 0
            elif m == "success_rate":
                completed = sum(1 for c in calls_list if c.get("status") == "completed")
                return round(completed / total * 100, 1) if total > 0 else 0
            elif m == "escalations":
                return sum(1 for c in calls_list if c.get("escalated"))
            return 0

        current_val = calc_metric(current_calls, metric)
        previous_val = calc_metric(previous_calls, metric)
        change = current_val - previous_val
        change_pct = round(change / previous_val * 100, 1) if previous_val > 0 else 0

        trend = "stable"
        if change > 0:
            trend = "up"
        elif change < 0:
            trend = "down"

        return {
            "metric": metric,
            "current": current_val,
            "previous": previous_val,
            "change": round(change, 1),
            "changePercent": change_pct,
            "trend": trend
        }

    def _parse_time_range(self, time_range: str) -> int:
        """Parse time range string to days"""
        unit = time_range[-1]
        value = int(time_range[:-1])

        if unit == "d":
            return value
        elif unit == "w":
            return value * 7
        elif unit == "m":
            return value * 30
        elif unit == "h":
            return 1

        return 7
