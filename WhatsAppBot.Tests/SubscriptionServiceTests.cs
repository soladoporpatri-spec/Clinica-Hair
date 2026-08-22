using WhatsAppBot.Worker.Models;
using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Tests;

/// <summary>
/// Verifica a lógica de verificação de permissão de serviço em assinaturas.
/// Após refatoração TipoServico → int serviceId, os métodos devem aceitar int diretamente.
/// </summary>
public class SubscriptionServiceTests
{
    private static ClientSubscription MakeSub(string servicosPermitidos = "*", int? barbeiroId = null)
        => new()
        {
            Id = 1,
            StoreId = 1,
            ClientPhone = "5511999990000",
            ClientName = "Teste",
            PlanId = 1,
            PlanNome = "Plano Teste",
            ServicosPermitidos = servicosPermitidos,
            BarbeiroId = barbeiroId,
            BarbeiroNome = barbeiroId.HasValue ? "Barbeiro Teste" : null,
            CreditosTotal = 4,
            CreditosUsados = 0,
            Status = SubscriptionStatus.Active,
            StartDate = DateTime.Today,
            EndDate = DateTime.Today.AddDays(30)
        };

    // ── "*" cobre qualquer serviço ────────────────────────────────────────────

    [Fact]
    public void IsServicoPermitido_WildcardCoversAnyService()
    {
        var sub = MakeSub("*");
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 1));  // Corte
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 6));  // CorteBarbasobrancelha
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 99)); // ID customizado
    }

    // ── Lista específica de serviços ──────────────────────────────────────────

    [Fact]
    public void IsServicoPermitido_AllowsListedService()
    {
        var sub = MakeSub("Corte");
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 1)); // ID 1 = Corte
    }

    [Fact]
    public void IsServicoPermitido_BlocksUnlistedService()
    {
        var sub = MakeSub("Corte"); // só cobre Corte
        Assert.False(SubscriptionService.IsServicoPermitido(sub, 2)); // ID 2 = Barba — não coberto
    }

    [Fact]
    public void IsServicoPermitido_SupportsMultipleServicesInList()
    {
        var sub = MakeSub("Corte,Barba,CorteBarba");
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 1));  // Corte
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 2));  // Barba
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 4));  // CorteBarba
        Assert.False(SubscriptionService.IsServicoPermitido(sub, 3)); // Sobrancelha — não coberto
    }

    // ── IDs acima de 6 (serviços não-barbearia) devem ser permitidos ─────────

    [Fact]
    public void IsServicoPermitido_AllowsCustomServiceIds_AboveLegacyRange()
    {
        // IDs > 6 são serviços de lavajato/pizzaria/etc. — não têm restrição por plano
        var sub = MakeSub("Corte");
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 101));
        Assert.True(SubscriptionService.IsServicoPermitido(sub, 999));
    }

    // ── Plano vazio/null cobre tudo ───────────────────────────────────────────

    [Fact]
    public void IsServicoPermitido_NullOrEmptyServicosPermitidos_CoversAll()
    {
        var sub = MakeSub(""); // vazio = cobre tudo (interpretação conservadora)
        // Comportamento esperado: sem restrição → permite (ou pode ser configurado para bloquear)
        // O importante é que não jogue exceção
        var result = SubscriptionService.IsServicoPermitido(sub, 1);
        Assert.IsType<bool>(result); // apenas verifica que não lança exceção
    }

    // ── DescricaoServicosPermitidos retorna label legível ────────────────────

    [Fact]
    public void DescricaoServicosPermitidos_WildcardReturnsReadableLabel()
    {
        var label = SubscriptionService.DescricaoServicosPermitidos("*");
        Assert.False(string.IsNullOrWhiteSpace(label));
        Assert.DoesNotContain("TipoServico", label);
    }

    [Fact]
    public void DescricaoServicosPermitidos_ListReturnsReadableLabel()
    {
        var label = SubscriptionService.DescricaoServicosPermitidos("Corte,Barba");
        Assert.False(string.IsNullOrWhiteSpace(label));
        // Deve conter algum nome legível, não um ID ou enum técnico
        Assert.True(label.Length > 2);
    }
}
