//! Multi-round negotiation protocol.
//!
//! Pure function over a `NegotiationState`: same inputs → same outputs. The
//! protocol respects BATNA (each party's walk-away) and a concession curve
//! per `ConcessionStyle`. If there's no ZOPA (Zone Of Possible Agreement)
//! it walks away immediately; otherwise both parties move toward each
//! other by `ratio * gap` per round until they cross or the round budget
//! is exhausted.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConcessionStyle { Soft, Moderate, Aggressive }

impl ConcessionStyle {
    fn ratio(self) -> f64 {
        match self {
            Self::Soft => 0.45,
            Self::Moderate => 0.30,
            Self::Aggressive => 0.18,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Outcome { Agreement, WalkAway, Ongoing }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NegotiationRound {
    pub round_no: u32,
    pub buyer_offer: f64,
    pub seller_offer: f64,
    pub gap: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NegotiationState {
    pub buyer_target: f64,
    pub buyer_walk_away: f64,
    pub seller_target: f64,
    pub seller_walk_away: f64,
    pub style: ConcessionStyle,
    pub max_rounds: u32,
    #[serde(default)]
    pub rounds: Vec<NegotiationRound>,
    #[serde(default = "default_outcome")]
    pub outcome: Outcome,
    #[serde(default)]
    pub final_price: Option<f64>,
}

fn default_outcome() -> Outcome { Outcome::Ongoing }

impl NegotiationState {
    pub fn new(
        buyer_target: f64, buyer_walk_away: f64,
        seller_target: f64, seller_walk_away: f64,
    ) -> Self {
        Self {
            buyer_target, buyer_walk_away,
            seller_target, seller_walk_away,
            style: ConcessionStyle::Moderate, max_rounds: 5,
            rounds: Vec::new(), outcome: Outcome::Ongoing, final_price: None,
        }
    }

    /// ZOPA exists iff the seller's floor is ≤ the buyer's ceiling.
    pub fn has_zopa(&self) -> bool {
        self.seller_walk_away <= self.buyer_walk_away
    }
}

pub struct NegotiationProtocol;

impl NegotiationProtocol {
    pub fn run(state: &mut NegotiationState) {
        if !state.has_zopa() {
            state.outcome = Outcome::WalkAway;
            return;
        }
        let ratio = state.style.ratio();
        let mut buyer = state.buyer_target;
        let mut seller = state.seller_target;
        let close_threshold = (0.01 * (state.buyer_target + state.seller_target) / 2.0).max(0.5);

        for i in 1..=state.max_rounds {
            let gap = seller - buyer;
            state.rounds.push(NegotiationRound {
                round_no: i, buyer_offer: buyer, seller_offer: seller, gap,
            });
            if gap <= close_threshold {
                state.outcome = Outcome::Agreement;
                state.final_price = Some(((buyer + seller) / 2.0 * 100.0).round() / 100.0);
                return;
            }
            buyer = (buyer + gap * ratio).min(state.buyer_walk_away);
            seller = (seller - gap * ratio).max(state.seller_walk_away);
            if buyer >= seller {
                state.outcome = Outcome::Agreement;
                state.final_price = Some(((buyer + seller) / 2.0 * 100.0).round() / 100.0);
                return;
            }
        }
        state.outcome = Outcome::WalkAway;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agreement_within_zopa() {
        let mut s = NegotiationState::new(40.0, 50.0, 55.0, 42.0);
        s.max_rounds = 8;
        NegotiationProtocol::run(&mut s);
        assert_eq!(s.outcome, Outcome::Agreement);
        let p = s.final_price.unwrap();
        assert!((42.0..=50.0).contains(&p), "price {p} outside ZOPA");
    }

    #[test]
    fn walk_away_when_no_zopa() {
        let mut s = NegotiationState::new(20.0, 30.0, 60.0, 50.0);
        NegotiationProtocol::run(&mut s);
        assert_eq!(s.outcome, Outcome::WalkAway);
        assert!(s.final_price.is_none());
    }

    #[test]
    fn aggressive_style_uses_smaller_concessions() {
        let mut soft = NegotiationState::new(40.0, 50.0, 55.0, 42.0);
        soft.style = ConcessionStyle::Soft;
        let mut agg = NegotiationState::new(40.0, 50.0, 55.0, 42.0);
        agg.style = ConcessionStyle::Aggressive;
        NegotiationProtocol::run(&mut soft);
        NegotiationProtocol::run(&mut agg);
        // Aggressive negotiator concedes less → needs more rounds (or fails sooner).
        assert!(agg.rounds.len() >= soft.rounds.len());
    }
}
