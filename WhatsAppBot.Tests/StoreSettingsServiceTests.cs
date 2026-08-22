using WhatsAppBot.Worker.Models;
using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Tests;

/// <summary>
/// Verifica que StoreSettingsService prioriza chaves por-loja (Store_{id}_{key})
/// sobre chaves globais, e que lojas diferentes não vazam configurações entre si.
/// </summary>
public class StoreSettingsServiceTests
{
    private static async Task SeedConfigs(WhatsAppBot.Worker.Data.AppDbContext db, params (string Key, string Value)[] configs)
    {
        foreach (var (k, v) in configs)
            db.SystemConfigs.Add(new SystemConfig { Key = k, Value = v });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetString_ReturnsStoreSpecificOverGlobal()
    {
        using var db = TestDb.Create(tenantId: 1);
        await SeedConfigs(db,
            ("Msg_Welcome", "global welcome"),
            ("Store_1_Msg_Welcome", "loja 1 welcome"));

        var svc = new StoreSettingsService(db);
        Assert.Equal("loja 1 welcome", svc.GetString("Msg_Welcome"));
    }

    [Fact]
    public async Task GetString_FallsBackToGlobalWhenNoStoreOverride()
    {
        using var db = TestDb.Create(tenantId: 2);
        await SeedConfigs(db, ("Msg_Welcome", "global welcome"));

        var svc = new StoreSettingsService(db);
        Assert.Equal("global welcome", svc.GetString("Msg_Welcome"));
    }

    [Fact]
    public async Task GetString_FallsBackToCodeDefaultWhenKeyMissing()
    {
        using var db = TestDb.Create(tenantId: 1);

        var svc = new StoreSettingsService(db);
        Assert.Equal("fallback", svc.GetString("NonexistentKey", "fallback"));
    }

    [Fact]
    public async Task GetBool_ParsesTrueValue()
    {
        using var db = TestDb.Create(tenantId: 1);
        await SeedConfigs(db, ("Store_1_Active_Thanks", "true"));

        var svc = new StoreSettingsService(db);
        Assert.True(svc.GetBool("Active_Thanks"));
    }

    [Fact]
    public async Task GetBool_ReturnsFallbackForMissingKey()
    {
        using var db = TestDb.Create(tenantId: 1);
        var svc = new StoreSettingsService(db);
        Assert.False(svc.GetBool("Active_Thanks"));
        Assert.True(svc.GetBool("Active_Thanks", fallback: true));
    }

    [Fact]
    public async Task GetInt_ParsesIntValue()
    {
        using var db = TestDb.Create(tenantId: 1);
        await SeedConfigs(db, ("Store_1_Retention_Days", "21"));

        var svc = new StoreSettingsService(db);
        Assert.Equal(21, svc.GetInt("Retention_Days"));
    }

    [Fact]
    public async Task TenantIsolation_Store1OverrideDoesNotLeakToStore2()
    {
        // Store 1 tem override; Store 2 lê apenas o global
        var dbName = Guid.NewGuid().ToString();

        using var db1 = TestDb.Create(tenantId: 1, dbName: dbName);
        await SeedConfigs(db1,
            ("Msg_Welcome", "global"),
            ("Store_1_Msg_Welcome", "loja1 custom"));

        using var db2 = TestDb.Create(tenantId: 2, dbName: dbName);

        var svc1 = new StoreSettingsService(db1);
        var svc2 = new StoreSettingsService(db2);

        Assert.Equal("loja1 custom", svc1.GetString("Msg_Welcome"));
        Assert.Equal("global", svc2.GetString("Msg_Welcome")); // não vaza Store_1_
    }

    [Fact]
    public async Task Invalidate_ForcesReFetch()
    {
        using var db = TestDb.Create(tenantId: 1);
        await SeedConfigs(db, ("Store_1_Msg_Welcome", "original"));

        var svc = new StoreSettingsService(db);
        var first = svc.GetString("Msg_Welcome");

        // Altera no banco e invalida o cache interno
        var config = db.SystemConfigs.First(c => c.Key == "Store_1_Msg_Welcome");
        config.Value = "updated";
        await db.SaveChangesAsync();
        svc.Invalidate();

        var second = svc.GetString("Msg_Welcome");
        Assert.Equal("original", first);
        Assert.Equal("updated", second);
    }
}
