using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Tests;

public class MessageTemplateServiceTests
{
    private static MessageTemplateContext Ctx(
        string nome = "João",
        string servico = "Corte",
        string profissional = "Profissional A",
        string loja = "Barbearia XYZ",
        string data = "15/06",
        string hora = "10:30") =>
        new(nome, servico, profissional, loja, data, hora);

    [Fact]
    public void Apply_ReplacesNome()
    {
        var result = MessageTemplateService.Apply("Olá, {nome}!", Ctx(nome: "Maria"));
        Assert.Equal("Olá, Maria!", result);
    }

    [Fact]
    public void Apply_ReplacesServico()
    {
        var result = MessageTemplateService.Apply("{servico} confirmado.", Ctx(servico: "Lavagem"));
        Assert.Equal("Lavagem confirmado.", result);
    }

    [Fact]
    public void Apply_ReplacesLoja()
    {
        var result = MessageTemplateService.Apply("Bem-vindo à {loja}!", Ctx(loja: "CarWash Premium"));
        Assert.Equal("Bem-vindo à CarWash Premium!", result);
    }

    [Fact]
    public void Apply_ReplacesBarbeariAsAliasForLoja()
    {
        var result = MessageTemplateService.Apply("Saudades da {barbearia}!", Ctx(loja: "Corte&Cia"));
        Assert.Equal("Saudades da Corte&Cia!", result);
    }

    [Fact]
    public void Apply_ReplacesBarbeiroAsAliasForProfissional()
    {
        var result = MessageTemplateService.Apply("Com {barbeiro}.", Ctx(profissional: "Carlos"));
        Assert.Equal("Com Carlos.", result);
    }

    [Fact]
    public void Apply_ReplacesHorarioAsAliasForHora()
    {
        var result = MessageTemplateService.Apply("às {horario}.", Ctx(hora: "14:00"));
        Assert.Equal("às 14:00.", result);
    }

    [Fact]
    public void Apply_ReplacesDataAndHora()
    {
        var result = MessageTemplateService.Apply("{data} às {hora}", Ctx(data: "20/06", hora: "09:00"));
        Assert.Equal("20/06 às 09:00", result);
    }

    [Fact]
    public void Apply_AllPlaceholders()
    {
        var template = "Olá {nome}, seu {servico} em {loja} com {profissional} em {data} às {hora}.";
        var result = MessageTemplateService.Apply(template, Ctx());
        Assert.Equal("Olá João, seu Corte em Barbearia XYZ com Profissional A em 15/06 às 10:30.", result);
    }

    [Fact]
    public void Apply_ReturnsOriginalIfNoPlaceholders()
    {
        const string template = "Mensagem sem placeholders.";
        Assert.Equal(template, MessageTemplateService.Apply(template, Ctx()));
    }

    [Fact]
    public void Apply_HandlesEmptyNome()
    {
        var result = MessageTemplateService.Apply("Olá, {nome}!", Ctx(nome: ""));
        Assert.Equal("Olá, !", result);
    }

    [Fact]
    public void Apply_DoesNotContainHardcodedNytharDashboard()
    {
        var defaultMsg = "Ola, {nome}! Bem-vindo a {loja}.";
        var result = MessageTemplateService.Apply(defaultMsg, Ctx(loja: "Outro Negócio"));
        Assert.DoesNotContain("Nythar - Dashboard & Chatbot", result, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Outro Negócio", result);
    }
}
