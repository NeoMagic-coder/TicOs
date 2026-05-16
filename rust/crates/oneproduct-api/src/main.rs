//! Axum HTTP front for the autonomy layer.
//!
//! Endpoints:
//!   GET  /health
//!   GET  /api/v1/agents
//!   POST /api/v1/decision/evaluate
//!   POST /api/v1/negotiation/run
//!   POST /api/v1/reconcile

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use oneproduct_core::{
    agent::{Agent, AgentInput, AgentOutput, AgentRegistry, AgentSpec},
    decision::{AutonomyPolicy, DecisionEngine, DecisionRequest},
    goals::{reconcile_proposals, AgentGoalProfile, ReconcileStrategy},
    negotiation::{NegotiationProtocol, NegotiationState},
    Result,
};
use serde::Deserialize;
use std::sync::Arc;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    registry: AgentRegistry,
    decision: Arc<DecisionEngine>,
}

// ---------- A couple of demo agents to populate the registry ----------

struct NegotiationAgent { spec: AgentSpec }

#[async_trait::async_trait]
impl Agent for NegotiationAgent {
    fn spec(&self) -> &AgentSpec { &self.spec }
    async fn handle(&self, _input: AgentInput) -> Result<AgentOutput> {
        Ok(AgentOutput {
            agent_id: self.spec.agent_id.clone(),
            summary: "Müzakere planı hazır.".into(),
            findings: vec!["BATNA tanımlı".into(), "ZOPA kontrol edildi".into()],
            data: serde_json::json!({}),
            confidence: 0.88,
        })
    }
}

struct DynamicPricingAgent { spec: AgentSpec }

#[async_trait::async_trait]
impl Agent for DynamicPricingAgent {
    fn spec(&self) -> &AgentSpec { &self.spec }
    async fn handle(&self, _input: AgentInput) -> Result<AgentOutput> {
        Ok(AgentOutput {
            agent_id: self.spec.agent_id.clone(),
            summary: "Talep esnekliği bazlı fiyat ayarı önerildi.".into(),
            findings: vec![],
            data: serde_json::json!({"recommended_price": 459.0}),
            confidence: 0.91,
        })
    }
}

fn seed_registry() -> AgentRegistry {
    let reg = AgentRegistry::new();
    reg.register(Arc::new(NegotiationAgent {
        spec: AgentSpec {
            agent_id: "negotiation_agent".into(),
            name: "Negotiation Agent".into(),
            role: "Müzakere & Anlaşma".into(),
            goal: "BATNA/ZOPA bazlı tedarikçi pazarlığı".into(),
            allowed_tools: vec!["supplier_negotiation_simulator".into()],
            can_delegate_to: vec![],
            escalation_threshold: 0.7,
        },
    }));
    reg.register(Arc::new(DynamicPricingAgent {
        spec: AgentSpec {
            agent_id: "dynamic_pricing_agent".into(),
            name: "Dynamic Pricing Agent".into(),
            role: "Dinamik Fiyatlandırma".into(),
            goal: "Talep & rakip sinyalinden anlık fiyat".into(),
            allowed_tools: vec!["dynamic_price_engine".into()],
            can_delegate_to: vec![],
            escalation_threshold: 0.65,
        },
    }));
    reg
}

// ---------- Handlers ----------

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({"status":"ok","version":env!("CARGO_PKG_VERSION")}))
}

async fn list_agents(State(s): State<AppState>) -> impl IntoResponse {
    Json(s.registry.list())
}

async fn evaluate_decision(
    State(s): State<AppState>,
    Json(req): Json<DecisionRequest>,
) -> impl IntoResponse {
    Json(s.decision.evaluate(&req))
}

async fn run_negotiation(Json(mut state): Json<NegotiationState>) -> impl IntoResponse {
    NegotiationProtocol::run(&mut state);
    Json(state)
}

#[derive(Deserialize)]
struct ReconcileBody {
    proposals: Vec<serde_json::Value>,
    profiles: Vec<AgentGoalProfile>,
    #[serde(default = "default_strategy")]
    strategy: ReconcileStrategy,
}

fn default_strategy() -> ReconcileStrategy { ReconcileStrategy::Vote }

async fn reconcile(Json(body): Json<ReconcileBody>) -> impl IntoResponse {
    Json(reconcile_proposals(&body.proposals, &body.profiles, body.strategy))
}

async fn fallback() -> impl IntoResponse {
    (StatusCode::NOT_FOUND, Json(serde_json::json!({"error":"not_found"})))
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/v1/agents", get(list_agents))
        .route("/api/v1/decision/evaluate", post(evaluate_decision))
        .route("/api/v1/negotiation/run", post(run_negotiation))
        .route("/api/v1/reconcile", post(reconcile))
        .fallback(fallback)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()
            .add_directive("info".parse().unwrap()))
        .init();

    let state = AppState {
        registry: seed_registry(),
        decision: Arc::new(DecisionEngine::new(AutonomyPolicy::default())),
    };

    let app = router(state);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!(?addr, "oneproduct-api listening");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    fn test_app() -> Router {
        router(AppState {
            registry: seed_registry(),
            decision: Arc::new(DecisionEngine::new(AutonomyPolicy::default())),
        })
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let resp = test_app().oneshot(
            Request::builder().uri("/health").body(Body::empty()).unwrap()
        ).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn list_agents_returns_seeded() {
        let resp = test_app().oneshot(
            Request::builder().uri("/api/v1/agents").body(Body::empty()).unwrap()
        ).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let agents: Vec<AgentSpec> = serde_json::from_slice(&bytes).unwrap();
        assert!(agents.iter().any(|a| a.agent_id == "negotiation_agent"));
    }

    #[tokio::test]
    async fn decision_endpoint_auto_approves_small_change() {
        let body = serde_json::json!({
            "action": {"action_type":"price_change_pct","value":2.5},
            "risk_level":"low","confidence":0.9
        });
        let resp = test_app().oneshot(
            Request::builder().method("POST").uri("/api/v1/decision/evaluate")
                .header("content-type","application/json")
                .body(Body::from(serde_json::to_vec(&body).unwrap())).unwrap()
        ).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["status"], "auto_approved");
    }
}
