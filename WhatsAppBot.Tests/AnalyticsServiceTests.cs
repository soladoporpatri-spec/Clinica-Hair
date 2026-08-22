using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using WhatsAppBot.Worker.Models;
using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Tests;

/// <summary>
/// Verifica que o AnalyticsService:
/// 1. Usa chave de cache isolada por tenant (Store 1 não vaza dados para Store 2).
/// 2. Invalida o cache corretamente.
/// 3. Resolve nomes de serviço via ServiceCatalogService (não via enum hardcoded).
/// </summary>
public class AnalyticsServiceTests
{
    private static IMemoryCache CreateCache() => new MemoryCache(new MemoryCacheOptions());

    private static AnalyticsService CreateSvc(WhatsAppBot.Worker.Data.AppDbContext db, IMemoryCache cache)
    {
        var catalog = new ServiceCatalogService(db);
        var logger = NullLogger<AnalyticsService>.Instance;
        return new AnalyticsService(db, catalog, logger, cache);
    }

    private static void SeedStore(
        WhatsAppBot.Worker.Data.AppDbContext db,
        int storeId,
        int serviceId,
        string serviceName,
        int appointmentCount = 3)
    {
        db.TenantId = 0; // superadmin para inserção sem filtro
        db.Stores.Add(new Store
        {
            Id = storeId,
            Name = $"Loja {storeId}",
            Slug = $"loja-{storeId}",
            IsActive = true,
            BusinessType = BusinessType.Barbershop
        });
        db.Servicos.Add(new ServicoItem
        {
            Id = serviceId,
            StoreId = storeId,
            Nome = serviceName,
            DuracaoMinutos = 30,
            Preco = 50m,
            Ativo = true,
            Ordem = 1
        });
        for (var i = 0; i < appointmentCount; i++)
        {
            db.Appointments.Add(new Appointment
            {
                StoreId = storeId,
                ServiceId = serviceId,
                PhoneNumber = $"5511900000{storeId}{i:00}",
                ContactName = $"Cliente {i}",
                DateTime = DateTime.Now.AddDays(i + 1),
                DuracaoMinutos = 30,
                Preco = 50m,
                Status = "ativo"
            });
        }
        db.SaveChanges();
        db.TenantId = storeId; // restaura o filtro por tenant
    }

    [Fact]
    public async Task CacheKeys_AreTenantIsolated()
    {
        // Usa um único banco compartilhado e cache singleton compartilhado.
        var dbName = Guid.NewGuid().ToString();
        var cache = CreateCache();

        using var db1 = TestDb.Create(tenantId: 1, dbName: dbName);
        SeedStore(db1, storeId: 1, serviceId: 1, serviceName: "Corte", appointmentCount: 3);
        var svc1 = CreateSvc(db1, cache);

        using var db2 = TestDb.Create(tenantId: 2, dbName: dbName);
        SeedStore(db2, storeId: 2, serviceId: 101, serviceName: "Lavagem", appointmentCount: 7);
        var svc2 = CreateSvc(db2, cache);

        var data1 = await svc1.GetAnalyticsAsync();
        var data2 = await svc2.GetAnalyticsAsync();

        // Dados diferentes por tenant — sem vazamento de cache cross-tenant
        Assert.Equal(3, data1.TotalAppointments);
        Assert.Equal(7, data2.TotalAppointments);
    }

    [Fact]
    public async Task GetAnalyticsAsync_UsesServiceNameFromCatalog()
    {
        using var db = TestDb.Create(tenantId: 1);
        SeedStore(db, storeId: 1, serviceId: 99, serviceName: "Lavagem Completa", appointmentCount: 2);
        var cache = CreateCache();
        var svc = CreateSvc(db, cache);

        var data = await svc.GetAnalyticsAsync();

        // O nome deve vir do catálogo, não de um enum hardcoded
        var topSvc = data.PopularServices.FirstOrDefault();
        Assert.NotNull(topSvc);
        Assert.Equal("Lavagem Completa", topSvc.Service);
    }

    [Fact]
    public async Task InvalidateCache_ForcesReFetchOnNextCall()
    {
        using var db = TestDb.Create(tenantId: 1);
        SeedStore(db, storeId: 1, serviceId: 1, serviceName: "Corte", appointmentCount: 2);
        var cache = CreateCache();
        var svc = CreateSvc(db, cache);

        var before = await svc.GetAnalyticsAsync();
        Assert.Equal(2, before.TotalAppointments);

        // Adiciona mais um agendamento e invalida o cache
        db.TenantId = 0;
        db.Appointments.Add(new Appointment
        {
            StoreId = 1,
            ServiceId = 1,
            PhoneNumber = "55119999999999",
            ContactName = "Extra",
            DateTime = DateTime.Now.AddDays(10),
            DuracaoMinutos = 30,
            Preco = 50m,
            Status = "ativo"
        });
        await db.SaveChangesAsync();
        db.TenantId = 1;
        svc.InvalidateCache();

        var after = await svc.GetAnalyticsAsync();
        Assert.Equal(3, after.TotalAppointments);
    }

    [Fact]
    public async Task Analytics_DoesNotMixDataBetweenTenants_WhenCachedInOrder()
    {
        // Tenant 1 carrega primeiro e cacheia; tenant 2 deve carregar seus próprios dados
        var dbName = Guid.NewGuid().ToString();
        var cache = CreateCache();

        using var db1 = TestDb.Create(tenantId: 1, dbName: dbName);
        SeedStore(db1, storeId: 1, serviceId: 1, serviceName: "Corte", appointmentCount: 5);
        var svc1 = CreateSvc(db1, cache);
        _ = await svc1.GetAnalyticsAsync(); // aquece o cache para tenant 1

        using var db2 = TestDb.Create(tenantId: 2, dbName: dbName);
        SeedStore(db2, storeId: 2, serviceId: 2, serviceName: "Barba", appointmentCount: 2);
        var svc2 = CreateSvc(db2, cache);
        var data2 = await svc2.GetAnalyticsAsync();

        // Tenant 2 deve ver apenas os 2 agendamentos dele — não 5 do tenant 1
        Assert.Equal(2, data2.TotalAppointments);
    }
}
