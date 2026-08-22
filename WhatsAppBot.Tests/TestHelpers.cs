using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WhatsAppBot.Worker.Data;
using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Tests;

// ── Fake ITenantService ─────────────────────────────────────────────────────

public class TestTenantService(int tenantId) : ITenantService
{
    private int _tenantId = tenantId;
    public int GetTenantId() => _tenantId;
    public bool IsSuperAdmin() => _tenantId == 0;
    public void SetTenantId(int id) => _tenantId = id;
}

// ── InMemory AppDbContext factory ───────────────────────────────────────────

public static class TestDb
{
    /// <summary>
    /// Cria um AppDbContext isolado em memória com TenantId configurado.
    /// Cada chamada com um name único garante banco limpo.
    /// </summary>
    public static AppDbContext Create(int tenantId = 1, string? dbName = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName ?? Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options, new TestTenantService(tenantId));
        db.TenantId = tenantId;
        return db;
    }
}

// ── Fake HttpMessageHandler para WhatsAppClient ──────────────────────────────

public class FakeHttpMessageHandler(HttpStatusCode statusCode = HttpStatusCode.OK, string content = "{}") : HttpMessageHandler
{
    public int CallCount { get; private set; }
    public List<string> SentBodies { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        CallCount++;
        if (request.Content != null)
            SentBodies.Add(await request.Content.ReadAsStringAsync(cancellationToken));
        return new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(content)
        };
    }
}

// ── WhatsAppClient stub ──────────────────────────────────────────────────────

public static class TestWhatsAppClient
{
    /// <summary>
    /// Cria um WhatsAppClient apontando para um FakeHttpMessageHandler.
    /// O IServiceScopeFactory fornecido é um stub mínimo.
    /// </summary>
    public static (WhatsAppClient client, FakeHttpMessageHandler handler) Create()
    {
        var handler = new FakeHttpMessageHandler();
        var http = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:3001") };

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ApiKey"] = "test-key" })
            .Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(config);
        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();

        var client = new WhatsAppClient(http, config, scopeFactory);
        return (client, handler);
    }
}
