using WhatsAppBot.Worker.Endpoints;
using WhatsAppBot.Worker.Models;

namespace WhatsAppBot.Tests;

public class CustomerCrmTests
{
    [Fact]
    public void CustomerStatus_UsesRetentionVipAndBlockedRules()
    {
        Assert.Equal("novo", CustomerCrmEndpoints.ComputeStatus(1, 40m, 5, null, false, null, [], 60));
        Assert.Equal("recorrente", CustomerCrmEndpoints.ComputeStatus(2, 90m, 12, 28, false, null, [], 60));
        Assert.Equal("fiel", CustomerCrmEndpoints.ComputeStatus(5, 220m, 12, 25, false, null, [], 60));
        Assert.Equal("vip", CustomerCrmEndpoints.ComputeStatus(3, 700m, 20, 25, false, null, [], 60));
        Assert.Equal("sumido", CustomerCrmEndpoints.ComputeStatus(3, 120m, 65, 25, false, null, [], 60));
        Assert.Equal("inativo", CustomerCrmEndpoints.ComputeStatus(3, 120m, 130, 25, false, null, [], 60));
        Assert.Equal("bloqueado", CustomerCrmEndpoints.ComputeStatus(10, 900m, 2, 20, true, null, ["VIP"], 60));
    }

    [Fact]
    public void CustomerCrmEntities_RespectTenantFilter()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var seed = TestDb.Create(tenantId: 0, dbName: dbName))
        {
            seed.CustomerProfiles.AddRange(
                new CustomerProfile { StoreId = 1, CustomerKey = "11911111111", PhoneNumber = "11911111111", DisplayName = "Cliente Loja A" },
                new CustomerProfile { StoreId = 2, CustomerKey = "11911111111", PhoneNumber = "11911111111", DisplayName = "Cliente Loja B" });
            seed.CustomerTags.AddRange(
                new CustomerTag { StoreId = 1, Name = "VIP", Color = "#a855f7" },
                new CustomerTag { StoreId = 2, Name = "VIP", Color = "#a855f7" });
            seed.CustomerEvents.AddRange(
                new CustomerEvent { StoreId = 1, CustomerKey = "11911111111", Type = "note", Title = "Nota A" },
                new CustomerEvent { StoreId = 2, CustomerKey = "11911111111", Type = "note", Title = "Nota B" });
            seed.CustomerReminders.AddRange(
                new CustomerReminder { StoreId = 1, CustomerKey = "11911111111", Title = "Lembrete A", DueDate = DateTime.Today },
                new CustomerReminder { StoreId = 2, CustomerKey = "11911111111", Title = "Lembrete B", DueDate = DateTime.Today });
            seed.SaveChanges();
        }

        using var tenantOne = TestDb.Create(tenantId: 1, dbName: dbName);

        Assert.Single(tenantOne.CustomerProfiles.ToList());
        Assert.Equal("Cliente Loja A", tenantOne.CustomerProfiles.Single().DisplayName);
        Assert.Single(tenantOne.CustomerTags.ToList());
        Assert.Single(tenantOne.CustomerEvents.ToList());
        Assert.Equal("Nota A", tenantOne.CustomerEvents.Single().Title);
        Assert.Single(tenantOne.CustomerReminders.ToList());
        Assert.Equal("Lembrete A", tenantOne.CustomerReminders.Single().Title);
    }
}
