import sys
import os
import time
import requests
import json

# Ensure parent directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.session import SessionLocal
from app.businesses.models import Business
from app.rag.indexer import index_business_data

API_URL = "http://localhost:8000"

# 1. Evaluation dataset for MelTech Computers
EVAL_QUESTIONS = [
    {
        "question": "Do you sell new or used laptops?",
        "expected_answer_keywords": ["new", "refurbished", "both"],
        "type": "retrieval"
    },
    {
        "question": "What laptops do you have in stock?",
        "expected_answer_keywords": ["Lenovo", "ThinkPad", "HP", "ProBook"],
        "type": "retrieval"
    },
    {
        "question": "How much does the HP ProBook cost?",
        "expected_answer_keywords": ["5200"],
        "type": "retrieval"
    },
    {
        "question": "Do you do laptop screen replacement?",
        "expected_answer_keywords": ["screen", "replacement", "450"],
        "type": "retrieval"
    },
    {
        "question": "Do you offer any warranty on refurbished laptops?",
        "expected_answer_keywords": ["warranty", "6 months", "refurbished"],
        "type": "retrieval"
    },
    {
        "question": "What is the capital of Ghana?",
        "expected_answer_keywords": ["sorry", "information", "representative", "connect"],
        "type": "low_confidence"
    },
    {
        "question": "I want to talk to a human representative.",
        "expected_answer_keywords": ["notified", "shortly", "representative", "human"],
        "type": "handoff"
    }
]

def run_evaluation():
    print("=== STARTING EASYBIZ AI RAG EVALUATION SUITE ===")
    
    # 2. Query database for MelTech Computers
    db = SessionLocal()
    try:
        business = db.query(Business).filter(Business.business_name == "MelTech Computers").first()
        if not business:
            print("[ERROR] MelTech Computers business profile not found. Please seed the database first.")
            sys.exit(1)
        
        business_id = str(business.id)
        print(f"\nTarget Business: {business.business_name} (ID: {business_id})")
        
        # 3. Trigger reindexing to build vector store for evaluation
        print("Reindexing business data to build fresh vector stores...")
        reindex_results = index_business_data(business.id, db)
        print(f"Reindexing Complete: {reindex_results['chunks_indexed']} knowledge chunks indexed.")
        
    finally:
        db.close()

    eval_results = []
    total_questions = len(EVAL_QUESTIONS)
    passed_count = 0
    total_retrieval_score = 0.0
    total_response_time = 0.0
    hallucinations = 0
    handoff_correct = 0
    handoff_total = 0

    print("\nRunning Evaluation Queries...\n")
    print(f"{'QUESTION':<45} | {'SCORE':<5} | {'TIME (s)':<8} | {'STATUS':<6} | {'TYPE':<12}")
    print("-" * 88)

    for item in EVAL_QUESTIONS:
        question = item["question"]
        expected_keywords = item["expected_answer_keywords"]
        q_type = item["type"]

        start_time = time.time()
        
        # Call chat API
        payload = {
            "message": question,
            "channel": "evaluation",
            "customer_name": "AI Evaluator Bot"
        }
        res = requests.post(f"{API_URL}/chat/{business_id}", json=payload)
        elapsed = time.time() - start_time
        
        if res.status_code != 200:
            print(f"API Error for query '{question}': {res.text}")
            continue
            
        data = res.json()
        answer = data["answer"]
        score = data["confidence_score"]
        escalated = data["escalated"]

        # 1. Response accuracy (keyword match check)
        passed = any(kw.lower() in answer.lower() for kw in expected_keywords)
        
        # If unrelated query has high retrieval score but misses fallback keywords, it could be a hallucination
        is_hallucinated = False
        if q_type == "low_confidence":
            # If AI answers unrelated query with high confidence (>0.7), flag as hallucination
            if score > 0.70:
                is_hallucinated = True
                hallucinations += 1
        
        if q_type == "handoff":
            handoff_total += 1
            if escalated:
                handoff_correct += 1

        if passed and not is_hallucinated:
            passed_count += 1
            status_str = "PASSED"
        else:
            status_str = "FAILED"

        total_retrieval_score += score
        total_response_time += elapsed

        eval_results.append({
            "question": question,
            "expected_keywords": expected_keywords,
            "actual_answer": answer[:80] + "..." if len(answer) > 80 else answer,
            "retrieval_score": score,
            "response_time": elapsed,
            "passed": passed and not is_hallucinated,
            "type": q_type
        })

        print(f"{question[:45]:<45} | {score:<5.2f} | {elapsed:<8.3f} | {status_str:<6} | {q_type:<12}")

    # Calculate metrics
    response_accuracy = (passed_count / total_questions) * 100
    avg_retrieval_accuracy = (total_retrieval_score / total_questions) * 100
    avg_response_time = total_response_time / total_questions
    hallucination_rate = (hallucinations / total_questions) * 100
    handoff_correctness = (handoff_correct / handoff_total) * 100 if handoff_total > 0 else 100.0

    print("\n" + "=" * 50)
    print("             EVALUATION REPORT SUMMARY            ")
    print("=" * 50)
    print(f"Total Questions Evaluated : {total_questions}")
    print(f"Response Accuracy         : {response_accuracy:.1f}%")
    print(f"Retrieval Accuracy (Avg)  : {avg_retrieval_accuracy:.1f}%")
    print(f"Average Response Time     : {avg_response_time:.3f} seconds")
    print(f"Hallucination Rate        : {hallucination_rate:.1f}%")
    print(f"Human Handoff Correctness : {handoff_correctness:.1f}%")
    print("=" * 50)

    # Save report to evaluation_report.json
    report_data = {
        "metrics": {
            "response_accuracy_pct": response_accuracy,
            "average_retrieval_accuracy_pct": avg_retrieval_accuracy,
            "average_response_time_seconds": avg_response_time,
            "hallucination_rate_pct": hallucination_rate,
            "human_handoff_correctness_pct": handoff_correctness
        },
        "details": eval_results
    }
    with open("evaluation_report.json", "w") as f:
        json.dump(report_data, f, indent=4)
    print("\nSaved detailed report to 'evaluation_report.json'.\n")

if __name__ == "__main__":
    run_evaluation()
