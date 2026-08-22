using WhatsAppBot.Worker.Models;
using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Tests;

/// <summary>
/// Testes para VehicleService (CRM de veículos do lavajato).
/// Verifica: normalização de placa, upsert, isolamento por tenant,
/// histórico limitado a 3, atualização de LastUsed e utilitários estáticos.
/// </summary>
public class VehicleServiceTests
{
    // ── NormalizePlate ────────────────────────────────────────────────────────

    [Theory]
    [InlineData("abc-1234", "ABC1234")]
    [InlineData("ABC 1234", "ABC1234")]
    [InlineData("abc 1 d23", "ABC1D23")]
    [InlineData("  XYZ-9A10  ", "XYZ9A10")]
    public void NormalizePlate_NormalizesCorrectly(string input, string expected)
    {
        Assert.Equal(expected, VehicleService.NormalizePlate(input));
    }

    // ── FormatLabel ───────────────────────────────────────────────────────────

    [Fact]
    public void FormatLabel_ReturnsOnlyPlate_WhenNoModel()
    {
        var v = new ClientVehicle { Plate = "ABC1234", Model = null };
        Assert.Equal("ABC1234", VehicleService.FormatLabel(v));
    }

    [Fact]
    public void FormatLabel_IncludesModel_WhenAvailable()
    {
        var v = new ClientVehicle { Plate = "ABC1234", Model = "Civic Prata" };
        Assert.Equal("ABC1234 — Civic Prata", VehicleService.FormatLabel(v));
    }

    // ── ParseFreeText ─────────────────────────────────────────────────────────

    [Fact]
    public void ParseFreeText_ExtractsPlateAndModel()
    {
        var (plate, model) = VehicleService.ParseFreeText("ABC-1234 Civic Prata 2020");
        Assert.Equal("ABC1234", plate);
        Assert.Equal("Civic Prata 2020", model);
    }

    [Fact]
    public void ParseFreeText_ReturnsNullModel_WhenOnlyPlate()
    {
        var (plate, model) = VehicleService.ParseFreeText("ABC1234");
        Assert.Equal("ABC1234", plate);
        Assert.Null(model);
    }

    // ── UpsertAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Upsert_CreatesNewVehicle_WhenPlateNotExists()
    {
        using var db = TestDb.Create(tenantId: 1);
        var svc = new VehicleService(db);

        var result = await svc.UpsertAsync("5511999990000", "ABC-1234", "Civic Prata");

        Assert.Equal("ABC1234", result.Plate);
        Assert.Equal("Civic Prata", result.Model);
        Assert.Equal(1, db.ClientVehicles.Count());
    }

    [Fact]
    public async Task Upsert_UpdatesModel_WhenPlateAlreadyExists()
    {
        using var db = TestDb.Create(tenantId: 1);
        var svc = new VehicleService(db);

        await svc.UpsertAsync("5511999990000", "ABC1234", "Civic Preto");
        await svc.UpsertAsync("5511999990000", "ABC1234", "Civic Prata 2023"); // modelo atualizado

        Assert.Equal(1, db.ClientVehicles.Count()); // não criou duplicata
        var v = db.ClientVehicles.First();
        Assert.Equal("Civic Prata 2023", v.Model);
    }

    [Fact]
    public async Task Upsert_NormalizesPlate_BeforeCompare()
    {
        using var db = TestDb.Create(tenantId: 1);
        var svc = new VehicleService(db);

        await svc.UpsertAsync("5511999990000", "abc-1234", null);
        await svc.UpsertAsync("5511999990000", "ABC 1234", "GOL"); // mesma placa, diferente formato

        Assert.Equal(1, db.ClientVehicles.Count()); // upsert — não duplicou
        Assert.Equal("ABC1234", db.ClientVehicles.First().Plate);
    }

    // ── GetClientVehiclesAsync ────────────────────────────────────────────────

    [Fact]
    public async Task GetClientVehicles_ReturnsMax3_MostRecentFirst()
    {
        using var db = TestDb.Create(tenantId: 1);
        var svc = new VehicleService(db);
        var phone = "5511999990000";
        var now = DateTime.UtcNow;

        // Insere 4 veículos com LastUsed diferentes
        db.TenantId = 0;
        db.ClientVehicles.AddRange(
            new ClientVehicle { StoreId = 1, PhoneNumber = phone, Plate = "AAA0000", LastUsed = now.AddDays(-3) },
            new ClientVehicle { StoreId = 1, PhoneNumber = phone, Plate = "BBB0000", LastUsed = now.AddDays(-1) },
            new ClientVehicle { StoreId = 1, PhoneNumber = phone, Plate = "CCC0000", LastUsed = now.AddDays(-4) },
            new ClientVehicle { StoreId = 1, PhoneNumber = phone, Plate = "DDD0000", LastUsed = now } // mais recente
        );
        await db.SaveChangesAsync();
        db.TenantId = 1;

        var result = await svc.GetClientVehiclesAsync(phone);

        Assert.Equal(3, result.Count); // max 3
        Assert.Equal("DDD0000", result[0].Plate); // mais recente primeiro
        Assert.Equal("BBB0000", result[1].Plate);
        Assert.Equal("AAA0000", result[2].Plate);
        // "CCC0000" foi o 4º mais recente — não incluído
    }

    [Fact]
    public async Task GetClientVehicles_IsolatedByTenant()
    {
        var dbName = Guid.NewGuid().ToString();

        using var db1 = TestDb.Create(tenantId: 1, dbName: dbName);
        using var db2 = TestDb.Create(tenantId: 2, dbName: dbName);

        // Insere veículo para loja 1
        db1.TenantId = 0;
        db1.ClientVehicles.Add(new ClientVehicle
        {
            StoreId = 1, PhoneNumber = "5511999990000",
            Plate = "ABC1234", LastUsed = DateTime.UtcNow
        });
        await db1.SaveChangesAsync();
        db1.TenantId = 1;

        // Loja 2 NÃO deve ver veículos da loja 1
        var svc2 = new VehicleService(db2);
        var vehicles = await svc2.GetClientVehiclesAsync("5511999990000");

        Assert.Empty(vehicles);
    }

    [Fact]
    public async Task GetClientVehicles_ReturnsEmpty_WhenNoHistory()
    {
        using var db = TestDb.Create(tenantId: 1);
        var svc = new VehicleService(db);

        var result = await svc.GetClientVehiclesAsync("5511999990000");

        Assert.Empty(result);
    }
}
