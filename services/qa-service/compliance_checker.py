from typing import List, Dict, Any


class ComplianceChecker:
    def __init__(self):
        self.compliance_keywords = {
            "pii_exposure": [
                "social security",
                "ssn",
                "credit card",
                "password",
                "account number"
            ],
            "prohibited_language": [
                "guaranteed",
                "promise",
                "no risk",
                "always works"
            ]
        }
    
    async def check_compliance(
        self,
        transcript: List[Dict[str, str]],
        call_id: str,
        company_id: str
    ) -> Dict[str, Any]:
        """Check call for compliance issues"""
        
        issues = []
        
        # Check for PII exposure
        pii_issues = self._check_pii_exposure(transcript)
        issues.extend(pii_issues)
        
        # Check for prohibited language
        language_issues = self._check_prohibited_language(transcript)
        issues.extend(language_issues)
        
        # Additional compliance checks would go here
        
        return {
            "passed": len(issues) == 0,
            "issueCount": len(issues),
            "issues": issues,
            "severity": self._calculate_severity(issues)
        }
    
    def _check_pii_exposure(
        self,
        transcript: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """Check for exposed PII"""
        issues = []
        
        for entry in transcript:
            if entry.get('speaker') == 'ai':
                text = entry.get('text', '').lower()
                for keyword in self.compliance_keywords['pii_exposure']:
                    if keyword in text:
                        issues.append({
                            "type": "PII_EXPOSURE",
                            "severity": "HIGH",
                            "description": f"Potential PII exposure: '{keyword}'",
                            "timestamp": entry.get('timestamp')
                        })
        
        return issues
    
    def _check_prohibited_language(
        self,
        transcript: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """Check for prohibited language"""
        issues = []
        
        for entry in transcript:
            if entry.get('speaker') == 'ai':
                text = entry.get('text', '').lower()
                for phrase in self.compliance_keywords['prohibited_language']:
                    if phrase in text:
                        issues.append({
                            "type": "PROHIBITED_LANGUAGE",
                            "severity": "MEDIUM",
                            "description": f"Prohibited phrase used: '{phrase}'",
                            "timestamp": entry.get('timestamp')
                        })
        
        return issues
    
    def _calculate_severity(self, issues: List[Dict[str, Any]]) -> str:
        """Calculate overall severity"""
        if not issues:
            return "NONE"
        
        severities = [issue.get('severity', 'LOW') for issue in issues]
        
        if 'HIGH' in severities:
            return "HIGH"
        elif 'MEDIUM' in severities:
            return "MEDIUM"
        else:
            return "LOW"
