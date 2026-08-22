using WhatsAppBot.Worker.Models;
using WhatsAppBot.Worker.Services.Modules;

namespace WhatsAppBot.Tests;

public class SaasEvolutionTests
{
    [Fact]
    public async Task StorePaymentRecords_RespectTenantFilter()
    {
        await using var db = TestDb.Create(tenantId: 1);

        db.StorePaymentRecords.AddRange(
            new StorePaymentRecord
            {
                StoreId = 1,
                Plan = "Professional",
                Amount = 299m,
                PaidUntil = DateTime.Now.AddMonths(1),
                Status = StorePaymentStatus.Paid
            },
            new StorePaymentRecord
            {
                StoreId = 2,
                Plan = "Premium",
                Amount = 499m,
                PaidUntil = DateTime.Now.AddMonths(1),
                Status = StorePaymentStatus.Paid
            });
        await db.SaveChangesAsync();

        Assert.Single(db.StorePaymentRecords);
        Assert.Equal(1, db.StorePaymentRecords.Single().StoreId);

        db.TenantId = 2;
        Assert.Single(db.StorePaymentRecords);
        Assert.Equal(2, db.StorePaymentRecords.Single().StoreId);

        db.TenantId = 0;
        Assert.Equal(2, db.StorePaymentRecords.Count());
    }

    [Fact]
    public void ModuleCatalog_SeparatesSegmentSpecificModules()
    {
        var catalog = new ModuleCatalog();

        var loyalty = catalog.Find("barbershop_loyalty");
        var carwash = catalog.Find("carwash_operations");
        var tech = catalog.Find("computer_optimization");

        Assert.NotNull(loyalty);
        Assert.NotNull(carwash);
        Assert.NotNull(tech);
        Assert.True(loyalty!.Supports(BusinessType.Barbershop));
        Assert.False(loyalty.Supports(BusinessType.CarWash));
        Assert.True(carwash!.Supports(BusinessType.CarWash));
        Assert.False(carwash.Supports(BusinessType.ComputerOptimization));
        Assert.True(tech!.Supports(BusinessType.ComputerOptimization));
        Assert.False(tech.Supports(BusinessType.Barbershop));
    }
}
