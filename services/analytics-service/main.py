from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv

from kpi_calculator import KPICalculator
from analytics_engine import AnalyticsEngine

load_dotenv()

app = FastAPI(title="Analytics Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

kpi_calculator = KPICalculator()
analytics_engine = AnalyticsEngine()


@app.get("/kpi/summary")
async def get_kpi_summary(
    company_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get KPI summary for a time period"""
    try:
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).isoformat()
        if not end_date:
            end_date = datetime.now().isoformat()
        
        kpis = await kpi_calculator.calculate_kpis(
            company_id=company_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "success": True,
            "data": kpis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/calls")
async def get_call_analytics(
    company_id: str,
    time_range: str = Query("7d", regex="^[0-9]+[hdwm]$"),
    group_by: str = Query("day", regex="^(hour|day|week|month)$")
):
    """Get call volume analytics"""
    try:
        analytics = await analytics_engine.get_call_analytics(
            company_id=company_id,
            time_range=time_range,
            group_by=group_by
        )
        
        return {
            "success": True,
            "data": analytics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/agent-performance")
async def get_agent_performance(
    company_id: str,
    agent_id: Optional[str] = None
):
    """Get agent performance metrics"""
    try:
        performance = await analytics_engine.get_agent_performance(
            company_id=company_id,
            agent_id=agent_id
        )
        
        return {
            "success": True,
            "data": performance
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/tools")
async def get_tool_usage(
    company_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get tool usage statistics"""
    try:
        usage = await analytics_engine.get_tool_usage(
            company_id=company_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "success": True,
            "data": usage
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/trends")
async def get_trends(
    company_id: str,
    metric: str = Query(..., regex="^(calls|duration|success_rate|escalations)$")
):
    """Get trending data for a specific metric"""
    try:
        trends = await analytics_engine.get_trends(
            company_id=company_id,
            metric=metric
        )
        
        return {
            "success": True,
            "data": trends
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {
        "success": True,
        "service": "analytics-service",
        "status": "healthy"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ANALYTICS_SERVICE_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
