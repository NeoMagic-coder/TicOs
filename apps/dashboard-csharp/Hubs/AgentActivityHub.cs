using Microsoft.AspNetCore.SignalR;
using OneProduct.Dashboard.Models;

namespace OneProduct.Dashboard.Hubs;

/// <summary>
/// SignalR hub clients connect to in order to receive live agent
/// activity updates. The server pushes; clients don't invoke methods.
/// </summary>
public class AgentActivityHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        await Clients.Caller.SendAsync("welcome", new
        {
            connectionId = Context.ConnectionId,
            serverTime = DateTimeOffset.UtcNow,
        });
        await base.OnConnectedAsync();
    }
}

/// <summary>
/// Background service that periodically pings the FastAPI backend and
/// fans out simulated activity events to all connected dashboard
/// clients. Replace the simulator block with a real event source
/// (e.g. backend SSE/WebSocket) when wiring production telemetry.
/// </summary>
public class AgentActivityBroadcaster : BackgroundService
{
    private readonly IHubContext<AgentActivityHub> _hub;
    private readonly IServiceProvider _sp;
    private readonly ILogger<AgentActivityBroadcaster> _log;
    private static readonly string[] Statuses =
        new[] { "thinking", "tool_call", "completed", "idle", "escalated" };
    private static readonly string[] DemoSummaries =
        new[]
        {
            "Rakip fiyat taraması tamamlandı.",
            "Tedarikçi karşı teklifi değerlendiriliyor.",
            "Stok forecast → reorder noktası güncel.",
            "Marj %22 eşiği koruma altında.",
            "Kargo tarifeleri karşılaştırıldı.",
            "Talep sinyali yükselişte.",
        };

    public AgentActivityBroadcaster(
        IHubContext<AgentActivityHub> hub,
        IServiceProvider sp,
        ILogger<AgentActivityBroadcaster> log)
    {
        _hub = hub;
        _sp = sp;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var rng = new Random();
        // Wait a tick so SignalR is fully wired up before first broadcast.
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _sp.CreateScope();
                var api = scope.ServiceProvider.GetRequiredService<Services.AgentApiClient>();
                var agents = await api.GetAgentsAsync(stoppingToken);
                if (agents.Count == 0)
                {
                    await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
                    continue;
                }

                var picked = agents[rng.Next(agents.Count)];
                var activity = new AgentActivity(
                    AgentId: picked.AgentId,
                    Status: Statuses[rng.Next(Statuses.Length)],
                    Confidence: Math.Round(0.65 + rng.NextDouble() * 0.30, 2),
                    Summary: DemoSummaries[rng.Next(DemoSummaries.Length)],
                    At: DateTimeOffset.UtcNow);

                await _hub.Clients.All.SendAsync(
                    "activity", activity, cancellationToken: stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "broadcast.iteration.failed");
            }

            await Task.Delay(TimeSpan.FromMilliseconds(1500), stoppingToken);
        }
    }
}
