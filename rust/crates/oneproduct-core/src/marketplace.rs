//! Marketplace router — decentralized dispatch over the coordination bus.
//!
//! Sends a request to every registered marketplace agent (Trendyol,
//! Hepsiburada, Shopify, …) in parallel, collects their bids with a per-
//! agent timeout, and reconciles via `goals::reconcile_proposals`.

use crate::coordination::{CoordinationBus, CoordinationMessage};
use crate::goals::{reconcile_proposals, AgentGoalProfile, ReconcileStrategy, ReconciliationResult};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceTarget {
    pub marketplace: String,
    pub agent_id: String,
    pub profile: AgentGoalProfile,
}

pub struct MarketplaceRouter {
    bus: CoordinationBus,
    targets: Vec<MarketplaceTarget>,
    sender_id: String,
    response_timeout: Duration,
}

impl MarketplaceRouter {
    pub fn new(bus: CoordinationBus, targets: Vec<MarketplaceTarget>) -> Self {
        Self {
            bus, targets,
            sender_id: "marketplace_router".into(),
            response_timeout: Duration::from_secs(5),
        }
    }

    pub fn with_timeout(mut self, t: Duration) -> Self {
        self.response_timeout = t; self
    }

    pub fn sender_id(&self) -> &str { &self.sender_id }

    /// Reply queue convention: callers route their response message to
    /// `recipient = format!("{sender_id}:{agent_id}")` so each round-trip
    /// has its own slot.
    pub fn reply_address(&self, agent_id: &str) -> String {
        format!("{}:{}", self.sender_id, agent_id)
    }

    pub async fn dispatch(
        &self,
        topic: &str,
        payload: serde_json::Value,
        marketplaces: Option<&[String]>,
    ) -> ReconciliationResult {
        let targets: Vec<&MarketplaceTarget> = match marketplaces {
            Some(filter) => self.targets.iter()
                .filter(|t| filter.iter().any(|m| m == &t.marketplace))
                .collect(),
            None => self.targets.iter().collect(),
        };
        if targets.is_empty() {
            return ReconciliationResult {
                winner: None, scores: vec![],
                strategy: ReconcileStrategy::Vote, vetoed_by: vec![],
            };
        }

        // 1) Fan-out the request to every marketplace agent.
        let mut publishes = Vec::with_capacity(targets.len());
        for t in &targets {
            let mut p = payload.clone();
            if let Some(obj) = p.as_object_mut() {
                obj.insert("marketplace".into(), serde_json::Value::String(t.marketplace.clone()));
            }
            publishes.push(self.bus.publish(CoordinationMessage::new(
                &self.sender_id, &t.agent_id, topic, p,
            )));
        }
        for f in publishes { f.await; }

        // 2) Collect responses in parallel with per-target timeout.
        let mut tasks = Vec::with_capacity(targets.len());
        for t in &targets {
            let bus = self.bus.clone();
            let addr = self.reply_address(&t.agent_id);
            let to = self.response_timeout;
            tasks.push(tokio::spawn(async move {
                bus.subscribe(&addr, Some(to)).await
            }));
        }

        let mut proposals: Vec<serde_json::Value> = Vec::new();
        for (handle, target) in tasks.into_iter().zip(targets.iter()) {
            if let Ok(Some(msg)) = handle.await {
                let mut proposal = msg.payload.clone();
                if let Some(obj) = proposal.as_object_mut() {
                    obj.entry("proposal_id".to_string()).or_insert_with(|| {
                        serde_json::Value::String(format!(
                            "{}:{}", target.marketplace, msg.correlation_id
                        ))
                    });
                    obj.insert("marketplace".into(), serde_json::Value::String(target.marketplace.clone()));
                    obj.insert("agent_id".into(), serde_json::Value::String(target.agent_id.clone()));
                }
                proposals.push(proposal);
            }
        }

        let profiles: Vec<AgentGoalProfile> =
            targets.iter().map(|t| t.profile.clone()).collect();
        reconcile_proposals(&proposals, &profiles, ReconcileStrategy::Vote)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::goals::Objective;

    #[tokio::test]
    async fn router_collects_and_reconciles_bids() {
        let bus = CoordinationBus::new();
        let targets = vec![
            MarketplaceTarget {
                marketplace: "trendyol".into(), agent_id: "seller_ty".into(),
                profile: AgentGoalProfile::new("seller_ty", Objective::MaximizeMargin),
            },
            MarketplaceTarget {
                marketplace: "hepsiburada".into(), agent_id: "seller_hb".into(),
                profile: AgentGoalProfile::new("seller_hb", Objective::MaximizeMargin),
            },
        ];
        let router = MarketplaceRouter::new(bus.clone(), targets)
            .with_timeout(Duration::from_millis(500));

        let reply_ty = router.reply_address("seller_ty");
        let reply_hb = router.reply_address("seller_hb");

        // Simulate marketplace agents publishing back to their reply queues.
        let bus_clone = bus.clone();
        let r1 = reply_ty.clone();
        let r2 = reply_hb.clone();
        let bidder = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(20)).await;
            bus_clone.publish(CoordinationMessage::new(
                "seller_ty", &r1, "bid.response",
                serde_json::json!({"proposal_id":"ty_bid","margin_pct":24.0}),
            )).await;
            bus_clone.publish(CoordinationMessage::new(
                "seller_hb", &r2, "bid.response",
                serde_json::json!({"proposal_id":"hb_bid","margin_pct":31.0}),
            )).await;
        });

        let result = router.dispatch(
            "bid.request",
            serde_json::json!({"sku":"SKU1"}),
            None,
        ).await;
        bidder.await.unwrap();

        let winner = result.winner.expect("a winner");
        assert_eq!(winner["proposal_id"], "hb_bid");
    }
}
