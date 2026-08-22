using System.Text;
using Microsoft.Extensions.Configuration;
using WhatsAppBot.Worker.Models;
using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Tests;

public class PixServiceTests
{
    [Fact]
    public void BuildPayload_GeneratesBrCodeWithAmountTxIdAndValidCrc()
    {
        var payload = PixService.BuildPayload(new PixPayloadRequest(
            "cliente@example.com",
            12.50m,
            "Nythar - Dashboard & Chatbot",
            "Anapolis",
            "SUB123",
            "Plano mensal"));

        Assert.StartsWith("000201", payload);
        Assert.Contains("br.gov.bcb.pix", payload);
        Assert.Contains("5303986", payload);
        Assert.Contains("540512.50", payload);
        Assert.Contains("5802BR", payload);
        Assert.Contains("62100506SUB123", payload);
        Assert.Matches("6304[0-9A-F]{4}$", payload);
        Assert.Equal(ExpectedCrc(payload[..^4]), payload[^4..]);
    }

    [Fact]
    public async Task CreateSubscriptionCharge_UsesBarberPixBeforeStorePixAndPersistsPayload()
    {
        await using var db = TestDb.Create(tenantId: 1);
        db.SystemConfigs.AddRange(
            new SystemConfig { Key = "Store_1_PixKey", Value = "loja@example.com" },
            new SystemConfig { Key = "Barbeiro_7_PixKey", Value = "barbeiro@example.com" },
            new SystemConfig { Key = "Store_1_PixMerchantCity", Value = "Anapolis" });

        var sub = new ClientSubscription
        {
            Id = 10,
            StoreId = 1,
            ClientPhone = "556299999999",
            ClientName = "Cliente",
            PlanId = 1,
            PlanNome = "Plano Corte",
            PlanPreco = 89.90m,
            CreditosTotal = 4,
            Status = SubscriptionStatus.Pending,
            BarbeiroId = 7,
            BarbeiroNome = "Profissional A"
        };
        db.ClientSubscriptions.Add(sub);
        await db.SaveChangesAsync();

        var service = new PixService(db, EmptyConfig());
        var charge = await service.CreateSubscriptionChargeAsync(sub, new Store { Id = 1, Name = "Nythar - Dashboard & Chatbot" });

        Assert.True(charge.IsConfigured);
        Assert.Equal("barber", charge.PixKeySource);
        Assert.Equal("barbeiro@example.com", charge.PixKey);
        Assert.Equal("S1SUB10", charge.TxId);
        Assert.Contains("br.gov.bcb.pix", charge.Payload);
        Assert.StartsWith("data:image/png;base64,", charge.QrCodeDataUrl);
        Assert.Equal(charge.Payload, sub.PixPayload);
        Assert.Equal(charge.TxId, sub.PaymentReference);
        Assert.Equal("brcode", sub.PaymentProvider);
        Assert.NotNull(sub.PixGeneratedAt);
    }

    [Fact]
    public async Task CreateSubscriptionCharge_ReturnsNotConfiguredWhenPixKeyIsMissing()
    {
        await using var db = TestDb.Create(tenantId: 1);
        var sub = new ClientSubscription
        {
            Id = 11,
            StoreId = 1,
            ClientPhone = "556288888888",
            ClientName = "Cliente",
            PlanId = 1,
            PlanNome = "Plano Corte",
            PlanPreco = 50m,
            CreditosTotal = 4,
            Status = SubscriptionStatus.Pending
        };
        db.ClientSubscriptions.Add(sub);
        await db.SaveChangesAsync();

        var service = new PixService(db, EmptyConfig());
        var charge = await service.CreateSubscriptionChargeAsync(sub, new Store { Id = 1, Name = "Nythar - Dashboard & Chatbot" });

        Assert.False(charge.IsConfigured);
        Assert.NotEmpty(charge.Error ?? "");
        Assert.Null(sub.PixPayload);
    }

    private static IConfiguration EmptyConfig()
        => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();

    private static string ExpectedCrc(string value)
    {
        var crc = 0xFFFF;
        foreach (var b in Encoding.ASCII.GetBytes(value))
        {
            crc ^= b << 8;
            for (var i = 0; i < 8; i++)
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xFFFF;
        }

        return crc.ToString("X4");
    }
}
