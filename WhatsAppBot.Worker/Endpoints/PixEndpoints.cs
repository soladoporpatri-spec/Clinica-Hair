using QRCoder;
using Microsoft.EntityFrameworkCore;
using WhatsAppBot.Worker.Data;
using WhatsAppBot.Worker.Services;

namespace WhatsAppBot.Worker.Endpoints;

public static class PixEndpoints
{
    public static IEndpointRouteBuilder MapPixEndpoints(this IEndpointRouteBuilder app, string apiKey)
    {
        app.MapGet("/api/public/pix/qrcode", (HttpContext ctx, string payload) =>
        {
            if (string.IsNullOrWhiteSpace(payload))
                return Results.BadRequest(new { error = "Payload PIX ausente." });

            if (payload.Length > 512)
                return Results.BadRequest(new { error = "Payload PIX muito grande." });

            using var generator = new QRCodeGenerator();
            using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
            var png = new PngByteQRCode(data).GetGraphic(8);

            ctx.Response.Headers.CacheControl = "no-store";
            return Results.File(png, "image/png");
        });

        app.MapGet("/api/pix/subscription/{id:int}", async (
            HttpContext ctx,
            AppDbContext db,
            ITenantService tenantService,
            PixService pix,
            int id) =>
        {
            if (!EndpointAuth.IsAuthenticated(ctx, apiKey)) return Results.Unauthorized();

            var storeId = tenantService.GetTenantId();
            if (storeId <= 0)
                return Results.BadRequest(new { error = "Loja nao identificada para gerar PIX." });

            db.TenantId = storeId;

            var subscription = await db.ClientSubscriptions
                .FirstOrDefaultAsync(s => s.Id == id && s.StoreId == storeId, ctx.RequestAborted);

            if (subscription == null)
                return Results.NotFound(new { error = "Assinatura nao encontrada." });

            var store = await db.Stores.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == storeId, ctx.RequestAborted);

            var charge = await pix.CreateSubscriptionChargeAsync(subscription, store, ctx.RequestAborted);
            if (!charge.IsConfigured)
                return Results.Conflict(new { error = charge.Error, pixKeySource = charge.PixKeySource });

            return Results.Ok(charge);
        });

        return app;
    }
}
