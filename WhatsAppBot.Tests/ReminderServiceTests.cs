using Microsoft.Extensions.Logging.Abstractions;
using WhatsAppBot.Worker.Models;
using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Tests;

/// <summary>
/// Verifica as regras de negócio do ReminderService:
/// — Active_Thanks: envia mensagem 2-4h após agendamento.
/// — Não envia duas vezes (ThanksSent = true protege de re-envio).
/// — Não envia para agendamentos cancelados.
/// — Lembrete 24h e 1h são enviados apenas uma vez.
/// </summary>
public class ReminderServiceTests
{
    private static ReminderService CreateSvc(WhatsAppBot.Worker.Data.AppDbContext db)
    {
        var (whatsapp, _) = TestWhatsAppClient.Create();
        var catalog = new ServiceCatalogService(db);
        var logger = NullLogger<ReminderService>.Instance;
        return new ReminderService(db, whatsapp, catalog, logger);
    }

    private static (WhatsAppBot.Worker.Data.AppDbContext db, FakeHttpMessageHandler handler, ReminderService svc) CreateAll()
    {
        var db = TestDb.Create(tenantId: 1);
        var (whatsapp, handler) = TestWhatsAppClient.Create();
        var catalog = new ServiceCatalogService(db);
        var logger = NullLogger<ReminderService>.Instance;
        var svc = new ReminderService(db, whatsapp, catalog, logger);
        return (db, handler, svc);
    }

    private static async Task SeedBase(WhatsAppBot.Worker.Data.AppDbContext db)
    {
        db.TenantId = 0;
        db.Stores.Add(new Store
        {
            Id = 1, Name = "Loja Teste", Slug = "loja-teste",
            IsActive = true, BridgeUrl = "http://localhost:3001"
        });
        db.Servicos.Add(new ServicoItem
        {
            Id = 1, StoreId = 1, Nome = "Corte",
            DuracaoMinutos = 30, Preco = 50m, Ativo = true, Ordem = 1
        });
        await db.SaveChangesAsync();
        db.TenantId = 1;
    }

    // ── Active_Thanks: não envia se já enviou ────────────────────────────────

    [Fact]
    public async Task Thanks_NotSentIfAlreadyMarked()
    {
        var (db, handler, svc) = CreateAll();
        await SeedBase(db);

        db.SystemConfigs.Add(new SystemConfig { Key = "Store_1_Active_Thanks", Value = "true" });
        db.Appointments.Add(new Appointment
        {
            StoreId = 1,
            ServiceId = 1,
            PhoneNumber = "5511999991111",
            ContactName = "João",
            // 3h atrás — dentro da janela 2-4h
            DateTime = AgendaService.GetBrazilNow().AddHours(-3),
            DuracaoMinutos = 30,
            Preco = 50m,
            Status = "ativo",
            ThanksSent = true // já enviado
        });
        await db.SaveChangesAsync();

        await svc.CheckAndSendRemindersAsync();

        // Nenhum envio deve ter ocorrido — ThanksSent = true protege
        Assert.Equal(0, handler.CallCount);
    }

    // ── Active_Thanks: não envia para cancelados ──────────────────────────────

    [Fact]
    public async Task Thanks_NotSentForCancelledAppointment()
    {
        var (db, handler, svc) = CreateAll();
        await SeedBase(db);

        db.SystemConfigs.Add(new SystemConfig { Key = "Store_1_Active_Thanks", Value = "true" });
        db.Appointments.Add(new Appointment
        {
            StoreId = 1,
            ServiceId = 1,
            PhoneNumber = "5511999992222",
            ContactName = "Maria",
            DateTime = AgendaService.GetBrazilNow().AddHours(-3),
            DuracaoMinutos = 30,
            Preco = 50m,
            Status = "cancelado", // cancelado não deve receber thanks
            ThanksSent = false
        });
        await db.SaveChangesAsync();

        await svc.CheckAndSendRemindersAsync();

        // Nenhum envio para cancelados
        Assert.Equal(0, handler.CallCount);
    }

    // ── Active_Thanks: não envia fora da janela (antes de 2h) ────────────────

    [Fact]
    public async Task Thanks_NotSentBeforeWindow()
    {
        var (db, handler, svc) = CreateAll();
        await SeedBase(db);

        db.SystemConfigs.Add(new SystemConfig { Key = "Store_1_Active_Thanks", Value = "true" });
        db.Appointments.Add(new Appointment
        {
            StoreId = 1,
            ServiceId = 1,
            PhoneNumber = "5511999993333",
            ContactName = "Pedro",
            // Só 30min atrás — fora da janela 2-4h
            DateTime = AgendaService.GetBrazilNow().AddMinutes(-30),
            DuracaoMinutos = 30,
            Preco = 50m,
            Status = "ativo",
            ThanksSent = false
        });
        await db.SaveChangesAsync();

        await svc.CheckAndSendRemindersAsync();

        Assert.Equal(0, handler.CallCount);
    }

    // ── Active_Thanks: não envia quando desabilitado ──────────────────────────

    [Fact]
    public async Task Thanks_NotSentWhenDisabled()
    {
        var (db, handler, svc) = CreateAll();
        await SeedBase(db);

        db.SystemConfigs.Add(new SystemConfig { Key = "Store_1_Active_Thanks", Value = "false" });
        db.Appointments.Add(new Appointment
        {
            StoreId = 1,
            ServiceId = 1,
            PhoneNumber = "5511999994444",
            ContactName = "Ana",
            DateTime = AgendaService.GetBrazilNow().AddHours(-3),
            DuracaoMinutos = 30,
            Preco = 50m,
            Status = "ativo",
            ThanksSent = false
        });
        await db.SaveChangesAsync();

        await svc.CheckAndSendRemindersAsync();

        Assert.Equal(0, handler.CallCount);
    }

    // ── Active_Thanks: ThanksSent marcado após envio bem-sucedido ─────────────

    [Fact]
    public async Task Thanks_MarksThanksSentAfterSuccessfulSend()
    {
        var (db, handler, svc) = CreateAll();
        await SeedBase(db);

        db.SystemConfigs.Add(new SystemConfig { Key = "Store_1_Active_Thanks", Value = "true" });
        var appt = new Appointment
        {
            StoreId = 1,
            ServiceId = 1,
            PhoneNumber = "5511999995555",
            ContactName = "Carlos",
            DateTime = AgendaService.GetBrazilNow().AddHours(-3),
            DuracaoMinutos = 30,
            Preco = 50m,
            Status = "ativo",
            ThanksSent = false
        };
        db.Appointments.Add(appt);
        await db.SaveChangesAsync();

        await svc.CheckAndSendRemindersAsync();

        // Recarrega do banco para verificar estado persistido
        db.ChangeTracker.Clear();
        var updated = db.Appointments.Find(appt.Id);
        Assert.NotNull(updated);
        Assert.True(updated!.ThanksSent, "ThanksSent deve ser true após envio bem-sucedido.");
        Assert.True(handler.CallCount > 0, "Mensagem de agradecimento deve ter sido enviada.");
    }

    // ── Lembrete 24h: não envia duas vezes ───────────────────────────────────

    [Fact]
    public async Task Reminder24h_NotSentIfAlreadySent()
    {
        var (db, handler, svc) = CreateAll();
        await SeedBase(db);

        db.SystemConfigs.Add(new SystemConfig { Key = "Store_1_Active_Reminder24h", Value = "true" });
        db.Appointments.Add(new Appointment
        {
            StoreId = 1,
            ServiceId = 1,
            PhoneNumber = "5511999996666",
            ContactName = "Lucia",
            DateTime = AgendaService.GetBrazilNow().AddHours(24),
            DuracaoMinutos = 30,
            Preco = 50m,
            Status = "ativo",
            ReminderDayBefore = true // já enviado
        });
        await db.SaveChangesAsync();

        await svc.CheckAndSendRemindersAsync();

        Assert.Equal(0, handler.CallCount);
    }
}
