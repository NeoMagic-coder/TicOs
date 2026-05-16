use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("permission denied: agent `{agent_id}` cannot use tool `{tool_id}`")]
    PermissionDenied { agent_id: String, tool_id: String },

    #[error("validation failed: {0}")]
    Validation(String),

    #[error("agent `{0}` not found")]
    AgentNotFound(String),

    #[error("negotiation walk-away: {0}")]
    NegotiationWalkAway(String),

    #[error("policy violation: {0}")]
    Policy(String),

    #[error("internal: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, CoreError>;
