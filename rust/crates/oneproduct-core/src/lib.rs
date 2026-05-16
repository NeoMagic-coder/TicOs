//! Multi-agent autonomy primitives for the OneProduct platform.
//!
//! This crate intentionally exposes small, composable building blocks:
//! - [`ontology`] — shared domain types every agent agrees on.
//! - [`coordination`] — async pub/sub bus; not a coordinator, just transport.
//! - [`negotiation`] — pure-function negotiation protocol with ZOPA/BATNA.
//! - [`decision`] — policy-gated autonomous decision engine.
//! - [`goals`] — agent goal/constraint profiles + multi-agent reconciliation.
//! - [`agent`] — `Agent` trait and a minimal in-process registry.
//! - [`marketplace`] — decentralized marketplace router built on the bus.

pub mod agent;
pub mod coordination;
pub mod decision;
pub mod error;
pub mod goals;
pub mod marketplace;
pub mod negotiation;
pub mod ontology;

pub use error::{CoreError, Result};
