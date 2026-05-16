//! Agent trait + minimal thread-safe registry.
//!
//! Every concrete agent (negotiation, logistics, dynamic pricing, …)
//! implements `Agent`. The registry is a `DashMap` keyed by agent_id; it
//! holds `Arc<dyn Agent + Send + Sync>` so multiple tasks can drive the
//! same agent concurrently.

use crate::error::{CoreError, Result};
use async_trait::async_trait;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSpec {
    pub agent_id: String,
    pub name: String,
    pub role: String,
    pub goal: String,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
    #[serde(default)]
    pub can_delegate_to: Vec<String>,
    #[serde(default = "default_threshold")]
    pub escalation_threshold: f64,
}

fn default_threshold() -> f64 { 0.6 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInput {
    pub message: String,
    #[serde(default)]
    pub product_context: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutput {
    pub agent_id: String,
    pub summary: String,
    #[serde(default)]
    pub findings: Vec<String>,
    #[serde(default)]
    pub data: serde_json::Value,
    pub confidence: f64,
}

#[async_trait]
pub trait Agent: Send + Sync {
    fn spec(&self) -> &AgentSpec;
    async fn handle(&self, input: AgentInput) -> Result<AgentOutput>;
}

#[derive(Default, Clone)]
pub struct AgentRegistry {
    agents: Arc<DashMap<String, Arc<dyn Agent>>>,
}

impl AgentRegistry {
    pub fn new() -> Self { Self::default() }

    pub fn register(&self, agent: Arc<dyn Agent>) {
        self.agents.insert(agent.spec().agent_id.clone(), agent);
    }

    pub fn get(&self, agent_id: &str) -> Result<Arc<dyn Agent>> {
        self.agents
            .get(agent_id)
            .map(|e| e.clone())
            .ok_or_else(|| CoreError::AgentNotFound(agent_id.to_string()))
    }

    pub fn list(&self) -> Vec<AgentSpec> {
        self.agents.iter().map(|e| e.value().spec().clone()).collect()
    }

    pub fn len(&self) -> usize { self.agents.len() }
    pub fn is_empty(&self) -> bool { self.agents.is_empty() }
}
