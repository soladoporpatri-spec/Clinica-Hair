using WhatsAppBot.Worker.Endpoints;
using WhatsAppBot.Worker.Models;

namespace WhatsAppBot.Tests;

public class OptimizationModuleTests
{
    [Fact]
    public void StatusTransitions_BlockInvalidJumpAndAllowOperationalFlow()
    {
        Assert.False(OptimizationEndpoints.CanTransition(
            OptimizationTicketStatus.Novo,
            OptimizationTicketStatus.Concluido));

        Assert.True(OptimizationEndpoints.CanTransition(
            OptimizationTicketStatus.Novo,
            OptimizationTicketStatus.Triagem));

        Assert.True(OptimizationEndpoints.CanTransition(
            OptimizationTicketStatus.Triagem,
            OptimizationTicketStatus.EmOtimizacao));

        Assert.True(OptimizationEndpoints.CanTransition(
            OptimizationTicketStatus.EmOtimizacao,
            OptimizationTicketStatus.Pronto));

        Assert.True(OptimizationEndpoints.CanTransition(
            OptimizationTicketStatus.Pronto,
            OptimizationTicketStatus.Concluido));
    }

    [Fact]
    public void StatusParser_AcceptsPortugueseLabelsWithSpacesAndAccents()
    {
        Assert.True(OptimizationEndpoints.TryParseStatus("Em otimização", out var running));
        Assert.Equal(OptimizationTicketStatus.EmOtimizacao, running);

        Assert.True(OptimizationEndpoints.TryParseStatus("Aguardando cliente", out var waiting));
        Assert.Equal(OptimizationTicketStatus.AguardandoCliente, waiting);

        Assert.True(OptimizationEndpoints.TryParseStatus("Concluído", out var done));
        Assert.Equal(OptimizationTicketStatus.Concluido, done);
    }

    [Fact]
    public void QuoteAmountValidation_BlocksZeroNegativeAndExtremeValues()
    {
        Assert.True(OptimizationEndpoints.IsValidQuoteAmount(20m));
        Assert.True(OptimizationEndpoints.IsValidQuoteAmount(100000m));

        Assert.False(OptimizationEndpoints.IsValidQuoteAmount(null));
        Assert.False(OptimizationEndpoints.IsValidQuoteAmount(0m));
        Assert.False(OptimizationEndpoints.IsValidQuoteAmount(-1m));
        Assert.False(OptimizationEndpoints.IsValidQuoteAmount(100000.01m));
    }

    [Fact]
    public void OptimizationTickets_RespectTenantFilter()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var seed = TestDb.Create(tenantId: 0, dbName: dbName))
        {
            seed.OptimizationTickets.AddRange(
                new OptimizationTicket
                {
                    StoreId = 1,
                    TicketNumber = "OPT-A",
                    PhoneNumber = "11999990000",
                    CustomerName = "Cliente A",
                    ReportedProblem = "PC lento"
                },
                new OptimizationTicket
                {
                    StoreId = 2,
                    TicketNumber = "OPT-B",
                    PhoneNumber = "11999990000",
                    CustomerName = "Cliente B",
                    ReportedProblem = "Windows lento"
                });
            seed.SaveChanges();
        }

        using var tenantOne = TestDb.Create(tenantId: 1, dbName: dbName);
        var visible = tenantOne.OptimizationTickets.ToList();

        Assert.Single(visible);
        Assert.Equal("OPT-A", visible[0].TicketNumber);
    }

    [Fact]
    public void OptimizationDevices_SamePhoneInDifferentStoresDoesNotMix()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var seed = TestDb.Create(tenantId: 0, dbName: dbName))
        {
            seed.OptimizationDevices.AddRange(
                new OptimizationDevice
                {
                    StoreId = 1,
                    CustomerName = "Lucas",
                    PhoneNumber = "11999990000",
                    DeviceType = "Desktop",
                    OperatingSystem = "Windows 11"
                },
                new OptimizationDevice
                {
                    StoreId = 2,
                    CustomerName = "Lucas em outra loja",
                    PhoneNumber = "11999990000",
                    DeviceType = "Notebook",
                    OperatingSystem = "Windows 10"
                });
            seed.SaveChanges();
        }

        using var tenantTwo = TestDb.Create(tenantId: 2, dbName: dbName);
        var devices = tenantTwo.OptimizationDevices.Where(d => d.PhoneNumber == "11999990000").ToList();

        Assert.Single(devices);
        Assert.Equal("Notebook", devices[0].DeviceType);
        Assert.Equal("Lucas em outra loja", devices[0].CustomerName);
    }
}
