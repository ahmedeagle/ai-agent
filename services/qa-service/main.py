from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import httpx
from dotenv import load_dotenv

from qa_scorer import QAScorer
from compliance_checker import ComplianceChecker

load_dotenv()

app = FastAPI(title="QA Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

qa_scorer = QAScorer()
compliance_checker = ComplianceChecker()

ADMIN_SERVICE_URL = os.getenv("ADMIN_SERVICE_URL", "http://localhost:3001")


# ============ MODELS ============

class QARequest(BaseModel):
    callId: str
    transcript: List[Dict[str, str]]
    agentId: str
    companyId: str


class ManualQARequest(BaseModel):
    callId: str
    score: int
    comments: Optional[str] = ""
    criteria: Optional[Dict[str, bool]] = {}
    reviewerId: str


class QARuleCreate(BaseModel):
    name: str
    description: str
    required: bool = True
    active: bool = True
    companyId: str
    agentId: Optional[str] = None


class QARuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    required: Optional[bool] = None
    active: Optional[bool] = None


# ============ QA EVALUATION ============

@app.post("/evaluate")
async def evaluate_call(request: QARequest):
    """Run automated QA evaluation on a call"""
    try:
        # Get QA rules for this agent/company from database
        qa_rules = await get_qa_rules(request.agentId, request.companyId)

        # Run automated scoring
        qa_result = await qa_scorer.score_call(
            transcript=request.transcript,
            qa_rules=qa_rules,
            call_id=request.callId
        )

        # Check compliance
        compliance_result = await compliance_checker.check_compliance(
            transcript=request.transcript,
            call_id=request.callId,
            company_id=request.companyId
        )

        # Save results to database via admin service
        try:
            async with httpx.AsyncClient() as client:
                await client.post(f"{ADMIN_SERVICE_URL}/qa-results", json={
                    "callId": request.callId,
                    "automatedScore": qa_result["score"],
                    "ruleResults": qa_result["ruleResults"],
                    "compliancePassed": compliance_result.get("passed", True),
                    "complianceIssues": compliance_result.get("issues", [])
                }, timeout=10.0)
        except Exception as save_error:
            print(f"Warning: Could not save QA result: {save_error}")

        result = {
            **qa_result,
            "compliance": compliance_result
        }

        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/manual-review")
async def manual_review(request: ManualQARequest):
    """Submit manual QA review"""
    try:
        from datetime import datetime

        review = {
            "callId": request.callId,
            "manualScore": request.score,
            "reviewComments": request.comments,
            "reviewerId": request.reviewerId,
            "reviewedAt": datetime.utcnow().isoformat()
        }

        # Save to database via admin service
        try:
            async with httpx.AsyncClient() as client:
                await client.put(
                    f"{ADMIN_SERVICE_URL}/qa-results/{request.callId}",
                    json=review,
                    timeout=10.0
                )
        except Exception as save_error:
            print(f"Warning: Could not save manual review: {save_error}")

        return {"success": True, "data": review}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ QA RESULTS ============

@app.get("/call/{call_id}/qa")
async def get_call_qa(call_id: str):
    """Get QA results for a specific call"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{ADMIN_SERVICE_URL}/qa-results/{call_id}",
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                return {"success": True, "data": data.get("data")}
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="QA results not found")


@app.get("/agent/{agent_id}/qa-summary")
async def get_agent_qa_summary(agent_id: str):
    """Get QA summary for an agent"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{ADMIN_SERVICE_URL}/qa-results/agent/{agent_id}/summary",
                timeout=10.0
            )
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass

    return {
        "success": True,
        "data": {
            "agentId": agent_id,
            "totalEvaluations": 0,
            "averageScore": 0,
            "passRate": 0,
            "commonIssues": []
        }
    }


# ============ QA RULES MANAGEMENT ============

@app.post("/rules")
async def create_qa_rule(rule: QARuleCreate):
    """Create a new QA rule for a company/agent"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ADMIN_SERVICE_URL}/qa-rules",
                json=rule.dict(),
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rules/{company_id}")
async def get_company_rules(company_id: str, agent_id: Optional[str] = None):
    """Get QA rules for a company, optionally filtered by agent"""
    try:
        params = {}
        if agent_id:
            params["agentId"] = agent_id

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{ADMIN_SERVICE_URL}/qa-rules/{company_id}",
                params=params,
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/rules/{rule_id}")
async def update_qa_rule(rule_id: str, rule: QARuleUpdate):
    """Update a QA rule"""
    try:
        update_data = {k: v for k, v in rule.dict().items() if v is not None}
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{ADMIN_SERVICE_URL}/qa-rules/{rule_id}",
                json=update_data,
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/rules/{rule_id}")
async def delete_qa_rule(rule_id: str):
    """Delete a QA rule"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{ADMIN_SERVICE_URL}/qa-rules/{rule_id}",
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ HEALTH ============

@app.get("/health")
async def health():
    return {
        "success": True,
        "service": "qa-service",
        "version": "2.0.0",
        "status": "healthy"
    }


# ============ HELPERS ============

DEFAULT_RULES = [
    {
        "id": "verify_identity",
        "name": "Verify Customer Identity",
        "description": "Agent must verify customer identity before proceeding",
        "required": True
    },
    {
        "id": "ask_confirmation",
        "name": "Ask Confirmation",
        "description": "Agent must ask for confirmation before taking action",
        "required": True
    },
    {
        "id": "proper_greeting",
        "name": "Proper Greeting",
        "description": "Agent must greet customer properly",
        "required": True
    },
    {
        "id": "proper_closing",
        "name": "Proper Closing",
        "description": "Agent must close call properly",
        "required": True
    }
]


async def get_qa_rules(agent_id: str, company_id: str):
    """Fetch QA rules from database, fall back to defaults"""
    try:
        async with httpx.AsyncClient() as client:
            # First try agent-specific rules
            response = await client.get(
                f"{ADMIN_SERVICE_URL}/qa-rules/{company_id}",
                params={"agentId": agent_id},
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                rules = data.get("data", [])
                if rules and len(rules) > 0:
                    return {
                        "rules": [
                            {
                                "id": r.get("id"),
                                "name": r.get("name"),
                                "description": r.get("description"),
                                "required": r.get("required", True)
                            }
                            for r in rules if r.get("active", True)
                        ]
                    }

            # Then try company-level rules
            response = await client.get(
                f"{ADMIN_SERVICE_URL}/qa-rules/{company_id}",
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                rules = data.get("data", [])
                if rules and len(rules) > 0:
                    return {
                        "rules": [
                            {
                                "id": r.get("id"),
                                "name": r.get("name"),
                                "description": r.get("description"),
                                "required": r.get("required", True)
                            }
                            for r in rules if r.get("active", True)
                        ]
                    }
    except Exception as e:
        print(f"Could not fetch QA rules from DB: {e}")

    # Fall back to default rules
    return {"rules": DEFAULT_RULES}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("QA_SERVICE_PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)
