using OneProduct.Dashboard.Components;
using OneProduct.Dashboard.Hubs;
using OneProduct.Dashboard.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddSignalR();

var apiBase = builder.Configuration["BackendApi:BaseUrl"] ?? "http://localhost:8000";
builder.Services.AddHttpClient<AgentApiClient>(c => c.BaseAddress = new Uri(apiBase));

// Background broadcaster: polls FastAPI and pushes deltas over SignalR.
builder.Services.AddSingleton<AgentActivityBroadcaster>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<AgentActivityBroadcaster>());

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.MapHub<AgentActivityHub>("/hubs/agents");

app.Run();
