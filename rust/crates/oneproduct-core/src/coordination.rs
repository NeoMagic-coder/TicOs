//! Async coordination bus — transport layer for inter-agent messages.
//!
//! Backed by `tokio::sync::mpsc` channels held in a `DashMap`. The bus is
//! *not* a coordinator: it carries messages, nothing else. Decision logic
//! lives in each agent. This avoids a single-point-of-failure and allows
//! horizontal scaling: the same trait can be backed by NATS/Redis Streams
//! in production by swapping the impl.

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use uuid::Uuid;

pub const BROADCAST: &str = "*";
const DEFAULT_QUEUE_CAPACITY: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationMessage {
    pub sender: String,
    pub recipient: String,
    pub topic: String,
    pub payload: serde_json::Value,
    pub correlation_id: String,
    pub sent_at: DateTime<Utc>,
}

impl CoordinationMessage {
    pub fn new(
        sender: impl Into<String>,
        recipient: impl Into<String>,
        topic: impl Into<String>,
        payload: serde_json::Value,
    ) -> Self {
        Self {
            sender: sender.into(),
            recipient: recipient.into(),
            topic: topic.into(),
            payload,
            correlation_id: Uuid::new_v4().simple().to_string()[..12].to_string(),
            sent_at: Utc::now(),
        }
    }
}

struct Slot {
    tx: mpsc::Sender<CoordinationMessage>,
    rx: Mutex<mpsc::Receiver<CoordinationMessage>>,
}

#[derive(Clone)]
pub struct CoordinationBus {
    inner: Arc<BusInner>,
}

struct BusInner {
    slots: DashMap<String, Arc<Slot>>,
    history: parking_lot::Mutex<Vec<CoordinationMessage>>,
    capacity: usize,
}

impl CoordinationBus {
    pub fn new() -> Self {
        Self::with_capacity(DEFAULT_QUEUE_CAPACITY)
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            inner: Arc::new(BusInner {
                slots: DashMap::new(),
                history: parking_lot::Mutex::new(Vec::new()),
                capacity,
            }),
        }
    }

    fn slot(&self, key: &str) -> Arc<Slot> {
        self.inner
            .slots
            .entry(key.to_string())
            .or_insert_with(|| {
                let (tx, rx) = mpsc::channel(self.inner.capacity);
                Arc::new(Slot { tx, rx: Mutex::new(rx) })
            })
            .clone()
    }

    pub async fn publish(&self, msg: CoordinationMessage) {
        self.inner.history.lock().push(msg.clone());
        if msg.recipient == BROADCAST {
            // Fan-out to every known queue (snapshot keys to avoid holding the map).
            let keys: Vec<String> = self.inner.slots.iter().map(|e| e.key().clone()).collect();
            for k in keys {
                let slot = self.slot(&k);
                let _ = slot.tx.send(msg.clone()).await;
            }
        } else {
            let slot = self.slot(&msg.recipient);
            let _ = slot.tx.send(msg).await;
        }
    }

    /// Receive the next message for `agent_id`, blocking up to `timeout`.
    pub async fn subscribe(
        &self,
        agent_id: &str,
        timeout: Option<Duration>,
    ) -> Option<CoordinationMessage> {
        let slot = self.slot(agent_id);
        let mut rx = slot.rx.lock().await;
        match timeout {
            None => rx.recv().await,
            Some(t) => tokio::time::timeout(t, rx.recv()).await.ok().flatten(),
        }
    }

    pub fn history(&self) -> Vec<CoordinationMessage> {
        self.inner.history.lock().clone()
    }

    pub fn clear(&self) {
        self.inner.slots.clear();
        self.inner.history.lock().clear();
    }
}

impl Default for CoordinationBus {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn direct_message_round_trip() {
        let bus = CoordinationBus::new();
        bus.publish(CoordinationMessage::new(
            "pricing_agent", "negotiation_agent", "price.update",
            serde_json::json!({"sku":"X1","price":100}),
        )).await;
        let m = bus.subscribe("negotiation_agent", Some(Duration::from_millis(500))).await;
        assert!(m.is_some());
        assert_eq!(m.unwrap().topic, "price.update");
    }

    #[tokio::test]
    async fn broadcast_reaches_known_subscribers() {
        let bus = CoordinationBus::new();
        // Register queues by sending one message to each recipient first.
        bus.publish(CoordinationMessage::new("x","a","t",serde_json::json!({}))).await;
        let _ = bus.subscribe("a", Some(Duration::from_millis(50))).await;
        bus.publish(CoordinationMessage::new("x","b","t",serde_json::json!({}))).await;
        let _ = bus.subscribe("b", Some(Duration::from_millis(50))).await;

        bus.publish(CoordinationMessage::new("supervisor", BROADCAST, "alert.low_stock",
            serde_json::json!({"sku":"Z9"}))).await;
        let a = bus.subscribe("a", Some(Duration::from_millis(200))).await.unwrap();
        let b = bus.subscribe("b", Some(Duration::from_millis(200))).await.unwrap();
        assert_eq!(a.topic, b.topic);
        assert_eq!(a.topic, "alert.low_stock");
    }

    #[tokio::test]
    async fn subscribe_times_out_when_empty() {
        let bus = CoordinationBus::new();
        let m = bus.subscribe("nobody", Some(Duration::from_millis(50))).await;
        assert!(m.is_none());
    }
}
