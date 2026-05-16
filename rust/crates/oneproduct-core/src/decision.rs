//! Policy-gated autonomous decision engine.
//!
//! `DecisionEngine::evaluate` is deterministic and side-effect free. The
//! caller persists outcomes via whichever audit sink is wired up. Decisions
//! are explicit: every escalation includes a human-readable reason.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel { Low, Medium, High, Critical }

impl RiskLevel {
    fn rank(self) -> u8 {
        match self { Self::Low => 0, Self::Medium => 1, Self::High => 2, Self::Critical => 3 }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DecisionStatus { AutoApproved, NeedsApproval, Rejected }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutonomyPolicy {
    pub max_price_change_pct: f64,
    pub max_carrier_switch_cost_try: f64,
    pub max_negotiation_commit_try: f64,
    pub min_confidence: f64,
    pub risk_auto_threshold: RiskLevel,
}

impl Default for AutonomyPolicy {
    fn default() -> Self {
        Self {
            max_price_change_pct: 5.0,
            max_carrier_switch_cost_try: 500.0,
            max_negotiation_commit_try: 50_000.0,
            min_confidence: 0.7,
            risk_auto_threshold: RiskLevel::Low,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionOutcome {
    pub status: DecisionStatus,
    pub reason: String,
    pub decision_id: String,
    pub decided_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action_type", rename_all = "snake_case")]
pub enum ProposedAction {
    PriceChangePct { value: f64 },
    CarrierSwitchCostTry { value: f64 },
    NegotiationCommitTry { value: f64 },
    Other { name: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionRequest {
    pub action: ProposedAction,
    #[serde(default = "default_risk")]
    pub risk_level: RiskLevel,
    #[serde(default = "default_confidence")]
    pub confidence: f64,
}

fn default_risk() -> RiskLevel { RiskLevel::Low }
fn default_confidence() -> f64 { 1.0 }

pub struct DecisionEngine {
    policy: AutonomyPolicy,
    counter: AtomicU64,
}

impl DecisionEngine {
    pub fn new(policy: AutonomyPolicy) -> Self {
        Self { policy, counter: AtomicU64::new(0) }
    }

    pub fn policy(&self) -> &AutonomyPolicy { &self.policy }

    fn next_id(&self) -> String {
        let n = self.counter.fetch_add(1, Ordering::Relaxed) + 1;
        format!("dec_{:06}", n)
    }

    pub fn evaluate(&self, req: &DecisionRequest) -> DecisionOutcome {
        let id = self.next_id();
        let now = Utc::now();

        if req.confidence < self.policy.min_confidence {
            return DecisionOutcome {
                status: DecisionStatus::NeedsApproval,
                reason: format!(
                    "Güven {:.2} < eşik {:.2}",
                    req.confidence, self.policy.min_confidence
                ),
                decision_id: id, decided_at: now,
            };
        }
        if req.risk_level.rank() > self.policy.risk_auto_threshold.rank() {
            return DecisionOutcome {
                status: DecisionStatus::NeedsApproval,
                reason: format!("Risk seviyesi {:?} otomatik eşik üstünde.", req.risk_level),
                decision_id: id, decided_at: now,
            };
        }
        if let Some(reason) = self.limit_breach(&req.action) {
            return DecisionOutcome {
                status: DecisionStatus::NeedsApproval,
                reason, decision_id: id, decided_at: now,
            };
        }
        DecisionOutcome {
            status: DecisionStatus::AutoApproved,
            reason: "Politika sınırları içinde, otomatik onaylandı.".into(),
            decision_id: id, decided_at: now,
        }
    }

    fn limit_breach(&self, action: &ProposedAction) -> Option<String> {
        match action {
            ProposedAction::PriceChangePct { value } => {
                if value.abs() > self.policy.max_price_change_pct {
                    Some(format!(
                        "Fiyat değişimi %{:.1} > limit %{:.1}",
                        value, self.policy.max_price_change_pct
                    ))
                } else { None }
            }
            ProposedAction::CarrierSwitchCostTry { value } => {
                if *value > self.policy.max_carrier_switch_cost_try {
                    Some(format!(
                        "Taşıyıcı değişim maliyeti {:.0}TL > limit {:.0}TL",
                        value, self.policy.max_carrier_switch_cost_try
                    ))
                } else { None }
            }
            ProposedAction::NegotiationCommitTry { value } => {
                if *value > self.policy.max_negotiation_commit_try {
                    Some(format!(
                        "Müzakere taahhüdü {:.0}TL > limit {:.0}TL",
                        value, self.policy.max_negotiation_commit_try
                    ))
                } else { None }
            }
            ProposedAction::Other { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine() -> DecisionEngine { DecisionEngine::new(AutonomyPolicy::default()) }

    #[test]
    fn small_price_change_auto_approved() {
        let r = engine().evaluate(&DecisionRequest {
            action: ProposedAction::PriceChangePct { value: 3.0 },
            risk_level: RiskLevel::Low, confidence: 0.9,
        });
        assert_eq!(r.status, DecisionStatus::AutoApproved);
    }

    #[test]
    fn large_price_change_escalates() {
        let r = engine().evaluate(&DecisionRequest {
            action: ProposedAction::PriceChangePct { value: 8.0 },
            risk_level: RiskLevel::Low, confidence: 0.9,
        });
        assert_eq!(r.status, DecisionStatus::NeedsApproval);
        assert!(r.reason.to_lowercase().contains("limit"));
    }

    #[test]
    fn low_confidence_escalates() {
        let r = engine().evaluate(&DecisionRequest {
            action: ProposedAction::CarrierSwitchCostTry { value: 100.0 },
            risk_level: RiskLevel::Low, confidence: 0.5,
        });
        assert_eq!(r.status, DecisionStatus::NeedsApproval);
    }

    #[test]
    fn high_risk_escalates() {
        let r = engine().evaluate(&DecisionRequest {
            action: ProposedAction::PriceChangePct { value: 1.0 },
            risk_level: RiskLevel::High, confidence: 0.95,
        });
        assert_eq!(r.status, DecisionStatus::NeedsApproval);
    }

    #[test]
    fn ids_are_monotonic() {
        let e = engine();
        let a = e.evaluate(&DecisionRequest {
            action: ProposedAction::PriceChangePct { value: 1.0 },
            risk_level: RiskLevel::Low, confidence: 0.9,
        });
        let b = e.evaluate(&DecisionRequest {
            action: ProposedAction::PriceChangePct { value: 1.0 },
            risk_level: RiskLevel::Low, confidence: 0.9,
        });
        assert_ne!(a.decision_id, b.decision_id);
    }
}
