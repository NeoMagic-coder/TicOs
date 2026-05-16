using System.Net.Http.Json;
using System.Text.Json;
using OneProduct.Dashboard.Models;

namespace OneProduct.Dashboard.Services;

/// <summary>
/// Typed client for the FastAPI backend.
/// Tolerates a backend that's still booting — returns an empty list rather
/// than throwing, so the dashboard stays interactive.
/// </summary>
public class AgentApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AgentApiClient> _log;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public AgentApiClient(HttpClient http, ILogger<AgentApiClient> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<IReadOnlyList<AgentSpec>> GetAgentsAsync(CancellationToken ct = default)
    {
        try
        {
            // Manual two-step: read raw, deserialize item-by-item so a single
            // schema mismatch doesn't drop the rest of the list.
            var raw = await _http.GetStringAsync("/api/v1/agents", ct);
            using var doc = JsonDocument.Parse(raw);
            var list = new List<AgentSpec>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                try
                {
                    var spec = el.Deserialize<AgentSpec>(JsonOpts);
                    if (spec is not null) list.Add(spec);
                }
                catch (Exception itemEx)
                {
                    var id = el.TryGetProperty("agent_id", out var p) ? p.GetString() : "?";
                    _log.LogWarning(itemEx, "agents.item.failed id={Id}", id);
                }
            }
            return list;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "agents.fetch.failed");
            return Array.Empty<AgentSpec>();
        }
    }

    public async Task<string> SendChatAsync(string message, CancellationToken ct = default)
    {
        try
        {
            var resp = await _http.PostAsJsonAsync(
                "/api/v1/chat",
                new { message, history = Array.Empty<object>() },
                ct);
            resp.EnsureSuccessStatusCode();
            var doc = await resp.Content.ReadFromJsonAsync<JsonElement>(JsonOpts, ct);
            return doc.TryGetProperty("summary", out var s) ? (s.GetString() ?? "") : doc.ToString();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "chat.send.failed");
            return $"⚠️ Backend ulaşılamıyor: {ex.Message}";
        }
    }
}
