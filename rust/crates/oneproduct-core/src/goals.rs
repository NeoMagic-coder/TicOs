//! Agent goal/constraint profiles and conflict reconciliation.
//!
//! Each agent declares an `Objective` (what to optimize), `hard_constraints`
//! (any violation vetoes the proposal entirely), and `soft_preferences`
//! (optional weighting). `reconcile_proposals` evaluates each proposal
//! against every profile and picks the highest weighted utility — with a
//! hard veto when any constraint is violated.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Objective {
    MaximizeMargin,
    MinimizeCost,
    MaximizeRevenue,
    MinimizeLeadTime,
    MaximizeBuyerValue,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReconcileStrategy { Vote, Pareto, Negotiate }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentGoalProfile {
    pub agent_id: String,
    pub objective: Objective,
    #[serde(default = "one")]
    pub weight: f64,
    /// Keys are `"min_<field>"` or `"max_<field>"` referring to a numeric
    /// field on the proposal. Violations veto (return -1 utility).
    #[serde(default)]
    pub hard_constraints: HashMap<String, f64>,
    #[serde(default)]
    pub soft_preferences: HashMap<String, f64>,
}

fn one() -> f64 { 1.0 }

impl AgentGoalProfile {
    pub fn new(agent_id: impl Into<String>, objective: Objective) -> Self {
        Self {
            agent_id: agent_id.into(), objective, weight: 1.0,
            hard_constraints: HashMap::new(), soft_preferences: HashMap::new(),
        }
    }

    pub fn with_weight(mut self, w: f64) -> Self { self.weight = w; self }

    pub fn with_hard(mut self, k: impl Into<String>, v: f64) -> Self {
        self.hard_constraints.insert(k.into(), v); self
    }

    /// Returns utility in [0,1], or `-1.0` if any hard constraint is violated.
    pub fn evaluate(&self, proposal: &serde_json::Value) -> f64 {
        if !self.satisfies_hard(proposal) { return -1.0; }
        default_utility(self.objective, proposal).clamp(0.0, 1.0)
    }

    fn satisfies_hard(&self, p: &serde_json::Value) -> bool {
        for (key, threshold) in &self.hard_constraints {
            let (op, field) = if let Some(s) = key.strip_prefix("min_") {
                ("min", s)
            } else if let Some(s) = key.strip_prefix("max_") {
                ("max", s)
            } else {
                continue;
            };
            let Some(v) = p.get(field).and_then(|x| x.as_f64()) else { continue };
            match op {
                "min" if v < *threshold => return false,
                "max" if v > *threshold => return false,
                _ => {}
            }
        }
        true
    }
}

fn default_utility(obj: Objective, p: &serde_json::Value) -> f64 {
    let f = |k: &str| p.get(k).and_then(|x| x.as_f64()).unwrap_or(0.0);
    match obj {
        Objective::MaximizeMargin => (f("margin_pct") / 50.0).clamp(0.0, 1.0),
        Objective::MinimizeCost => {
            let c = f("cost_try").max(1.0);
            1.0 / (1.0 + c / 100.0)
        }
        Objective::MaximizeRevenue => (f("expected_revenue_lift_pct") / 20.0).clamp(0.0, 1.0),
        Objective::MinimizeLeadTime => {
            let eta = if p.get("eta_hours").is_some() { f("eta_hours") } else { 72.0 };
            (1.0 - eta / 168.0).clamp(0.0, 1.0)
        }
        Objective::MaximizeBuyerValue => {
            let price = f("price_try");
            let budget = f("budget_try").max(1.0);
            (1.0 - price / budget).clamp(0.0, 1.0)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconciliationResult {
    pub winner: Option<serde_json::Value>,
    pub scores: Vec<(String, f64)>,
    pub strategy: ReconcileStrategy,
    pub vetoed_by: Vec<String>,
}

pub fn reconcile_proposals(
    proposals: &[serde_json::Value],
    profiles: &[AgentGoalProfile],
    strategy: ReconcileStrategy,
) -> ReconciliationResult {
    if proposals.is_empty() {
        return ReconciliationResult { winner: None, scores: vec![], strategy, vetoed_by: vec![] };
    }

    let mut scores: Vec<(String, f64)> = Vec::with_capacity(proposals.len());
    let mut vetoes: HashMap<String, Vec<String>> = HashMap::new();

    for p in proposals {
        let pid = p.get("proposal_id").and_then(|v| v.as_str()).unwrap_or("?").to_string();
        let mut total = 0.0;
        let mut total_w = 0.0;
        for profile in profiles {
            let u = profile.evaluate(p);
            if u < 0.0 {
                vetoes.entry(pid.clone()).or_default().push(profile.agent_id.clone());
                continue;
            }
            total += u * profile.weight;
            total_w += profile.weight;
        }
        let score = if total_w > 0.0 { total / total_w } else { 0.0 };
        scores.push((pid, score));
    }

    let mut survivors: Vec<(usize, f64)> = scores.iter().enumerate()
        .filter(|(_, (pid, _))| !vetoes.contains_key(pid))
        .map(|(i, (_, s))| (i, *s))
        .collect();

    let vetoed_by: Vec<String> = vetoes.values().flatten().cloned().collect();

    if survivors.is_empty() {
        return ReconciliationResult { winner: None, scores, strategy, vetoed_by };
    }

    survivors.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let winner_idx = survivors[0].0;
    ReconciliationResult {
        winner: Some(proposals[winner_idx].clone()),
        scores, strategy, vetoed_by,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn higher_weighted_utility_wins() {
        let proposals = vec![
            serde_json::json!({"proposal_id":"p1","margin_pct":35.0,"expected_revenue_lift_pct":4.0}),
            serde_json::json!({"proposal_id":"p2","margin_pct":28.0,"expected_revenue_lift_pct":14.0}),
        ];
        let profiles = vec![
            AgentGoalProfile::new("pricing", Objective::MaximizeMargin),
            AgentGoalProfile::new("growth", Objective::MaximizeRevenue).with_weight(2.0),
        ];
        let r = reconcile_proposals(&proposals, &profiles, ReconcileStrategy::Vote);
        assert_eq!(r.winner.unwrap()["proposal_id"], "p2");
    }

    #[test]
    fn hard_constraint_vetoes_proposal() {
        let proposals = vec![
            serde_json::json!({"proposal_id":"p1","margin_pct":12.0}),
            serde_json::json!({"proposal_id":"p2","margin_pct":30.0}),
        ];
        let profiles = vec![
            AgentGoalProfile::new("pricing", Objective::MaximizeMargin)
                .with_hard("min_margin_pct", 22.0),
        ];
        let r = reconcile_proposals(&proposals, &profiles, ReconcileStrategy::Vote);
        assert_eq!(r.winner.unwrap()["proposal_id"], "p2");
        assert!(r.vetoed_by.contains(&"pricing".to_string()));
    }

    #[test]
    fn empty_proposals_returns_no_winner() {
        let r = reconcile_proposals(&[], &[], ReconcileStrategy::Vote);
        assert!(r.winner.is_none());
    }
}
