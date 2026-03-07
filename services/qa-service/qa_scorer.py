import openai
import os
from typing import List, Dict, Any

openai.api_key = os.getenv("OPENAI_API_KEY")


class QAScorer:
    def __init__(self):
        self.client = openai.AsyncOpenAI()
    
    async def score_call(
        self,
        transcript: List[Dict[str, str]],
        qa_rules: Dict[str, Any],
        call_id: str
    ) -> Dict[str, Any]:
        """Score a call based on QA rules"""
        
        # Convert transcript to text
        transcript_text = self._format_transcript(transcript)
        
        # Evaluate each rule
        rule_results = {}
        for rule in qa_rules.get('rules', []):
            passed = await self._evaluate_rule(transcript_text, rule)
            rule_results[rule['id']] = {
                "name": rule['name'],
                "passed": passed,
                "required": rule.get('required', False)
            }
        
        # Calculate overall score
        total_rules = len(rule_results)
        passed_rules = sum(1 for r in rule_results.values() if r['passed'])
        score = (passed_rules / total_rules * 100) if total_rules > 0 else 0
        
        # Check if all required rules passed
        required_passed = all(
            r['passed'] for r in rule_results.values() if r['required']
        )
        
        return {
            "callId": call_id,
            "score": round(score, 2),
            "passed": required_passed and score >= 70,
            "ruleResults": rule_results,
            "summary": self._generate_summary(rule_results, score)
        }
    
    async def _evaluate_rule(
        self,
        transcript_text: str,
        rule: Dict[str, Any]
    ) -> bool:
        """Use LLM to evaluate if a rule was followed"""
        
        prompt = f"""
        Evaluate if the following conversation followed this rule:
        
        Rule: {rule['name']}
        Description: {rule['description']}
        
        Conversation:
        {transcript_text}
        
        Answer with only "YES" or "NO".
        """
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=10
            )
            
            answer = response.choices[0].message.content.strip().upper()
            return answer == "YES"
        except Exception as e:
            print(f"Error evaluating rule: {e}")
            return False
    
    def _format_transcript(self, transcript: List[Dict[str, str]]) -> str:
        """Format transcript for analysis"""
        lines = []
        for entry in transcript:
            speaker = entry.get('speaker', 'Unknown').upper()
            text = entry.get('text', '')
            lines.append(f"{speaker}: {text}")
        return "\n".join(lines)
    
    def _generate_summary(
        self,
        rule_results: Dict[str, Any],
        score: float
    ) -> str:
        """Generate human-readable summary"""
        failed_rules = [
            r['name'] for r in rule_results.values() if not r['passed']
        ]
        
        if score >= 90:
            return "Excellent quality. All critical aspects met."
        elif score >= 70:
            summary = "Good quality. "
            if failed_rules:
                summary += f"Minor issues: {', '.join(failed_rules)}"
            return summary
        else:
            return f"Needs improvement. Failed: {', '.join(failed_rules)}"
