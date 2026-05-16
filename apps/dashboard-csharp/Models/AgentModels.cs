using System.Text.Json.Serialization;

namespace OneProduct.Dashboard.Models;

public record AgentSpec(
    [property: JsonPropertyName("agent_id")] string AgentId,
    string Name,
    string Role,
    string Goal,
    string Icon,
    string Color,
    string Status,
    [property: JsonPropertyName("allowed_tools")] List<string> AllowedTools,
    AgentStats? Stats
);

public record AgentStats(
    [property: JsonPropertyName("tasks_completed_today")] double TasksCompletedToday,
    [property: JsonPropertyName("tasks_total")] double TasksTotal,
    [property: JsonPropertyName("success_rate")] double SuccessRate,
    [property: JsonPropertyName("avg_confidence")] double AvgConfidence,
    [property: JsonPropertyName("tools_used_today")] double ToolsUsedToday,
    [property: JsonPropertyName("avg_duration_ms")] double AvgDurationMs
);

/// <summary>Live activity delta pushed over SignalR.</summary>
public record AgentActivity(
    string AgentId,
    string Status,
    double Confidence,
    string Summary,
    DateTimeOffset At
);
