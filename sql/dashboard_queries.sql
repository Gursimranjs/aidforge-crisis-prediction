-- AidForge Dashboard Queries

-- Executive Summary Metrics
CREATE OR REPLACE VIEW aidforge_db.executive_summary AS
SELECT 
    COUNT(DISTINCT country) as total_countries,
    SUM(CASE WHEN aid_priority = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
    SUM(CASE WHEN aid_priority = 'URGENT' THEN 1 ELSE 0 END) as urgent_count,
    AVG(aid_need_score) as global_avg_risk,
    MAX(aid_need_score) as highest_risk_score
FROM aidforge_db.unified_clean
WHERE year = (SELECT MAX(year) FROM aidforge_db.unified_clean);

-- Top Crisis Countries
CREATE OR REPLACE VIEW aidforge_db.crisis_dashboard AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY predicted_score_2026 DESC) as rank,
    country,
    region,
    predicted_score_2026 as risk_score,
    predicted_priority_2026 as action_required
FROM aidforge_db.predictions_2026;
