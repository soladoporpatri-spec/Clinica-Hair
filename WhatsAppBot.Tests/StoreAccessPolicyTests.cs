using WhatsAppBot.Worker.Models;
using WhatsAppBot.Worker.Services;
using WhatsAppBot.Worker.Services.Modules;

namespace WhatsAppBot.Tests;

public class StoreAccessPolicyTests
{
    [Fact]
    public void StoreAccess_AllowsActiveCurrentStore()
    {
        var store = new Store
        {
            IsActive = true,
            IsSuspended = false,
            SubscriptionExpiry = DateTime.Now.AddDays(10)
        };

        var status = StoreAccessPolicy.Evaluate(store);

        Assert.True(status.CanOperate);
        Assert.Equal("ok", status.Reason);
    }

    [Theory]
    [InlineData(false, false, "inactive")]
    [InlineData(true, true, "suspended")]
    public void StoreAccess_BlocksInactiveOrSuspendedStores(bool active, bool suspended, string reason)
    {
        var store = new Store
        {
            IsActive = active,
            IsSuspended = suspended,
            SubscriptionExpiry = DateTime.Now.AddDays(10)
        };

        var status = StoreAccessPolicy.Evaluate(store);

        Assert.False(status.CanOperate);
        Assert.Equal(reason, status.Reason);
    }

    [Fact]
    public void StoreAccess_BlocksExpiredStores()
    {
        var store = new Store
        {
            IsActive = true,
            IsSuspended = false,
            SubscriptionExpiry = DateTime.Now.AddDays(-1)
        };

        var status = StoreAccessPolicy.Evaluate(store);

        Assert.False(status.CanOperate);
        Assert.Equal("subscription_expired", status.Reason);
    }

    [Theory]
    [InlineData("Free", "Starter")]
    [InlineData("Standard", "Professional")]
    [InlineData("Professional", "Professional")]
    [InlineData("Premium", "Premium")]
    [InlineData("Enterprise", "Enterprise")]
    public void PlanCatalog_NormalizesLegacyAndCurrentPlanNames(string raw, string expected)
        => Assert.Equal(expected, PlanCatalog.Normalize(raw));

    [Fact]
    public void PlanCatalog_KeepsStandardPlanCompatibleWithProfessionalModules()
    {
        var catalog = new ModuleCatalog();

        Assert.True(catalog.PlanAllows("Standard", "Professional"));
        Assert.False(catalog.PlanAllows("Starter", "Professional"));
    }
}
