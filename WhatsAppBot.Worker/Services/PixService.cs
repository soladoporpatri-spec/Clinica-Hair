using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using QRCoder;
using WhatsAppBot.Worker.Data;
using WhatsAppBot.Worker.Models;

namespace WhatsAppBot.Worker.Services;

public sealed record PixPayloadRequest(
    string PixKey,
    decimal Amount,
    string MerchantName,
    string MerchantCity,
    string TxId,
    string? Description = null);

public sealed record PixChargeResult(
    bool IsConfigured,
    string? Error,
    string PixKey,
    string PixKeySource,
    string MerchantName,
    string MerchantCity,
    string TxId,
    decimal Amount,
    string Description,
    string Payload,
    string QrCodeDataUrl);

public class PixService
{
    private const string PixGui = "br.gov.bcb.pix";
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public PixService(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    public async Task<PixChargeResult> CreateSubscriptionChargeAsync(
        ClientSubscription subscription,
        Store? store,
        CancellationToken ct = default)
    {
        var recipient = await ResolveRecipientAsync(
            subscription.StoreId,
            subscription.BarbeiroId,
            subscription.BarbeiroNome,
            store,
            ct);

        if (string.IsNullOrWhiteSpace(recipient.PixKey))
        {
            return new PixChargeResult(
                false,
                "Chave PIX nao configurada para este profissional ou loja.",
                "",
                recipient.Source,
                recipient.MerchantName,
                recipient.MerchantCity,
                "",
                subscription.PlanPreco,
                "",
                "",
                "");
        }

        var txId = !string.IsNullOrWhiteSpace(subscription.PaymentReference)
            ? SanitizeTxId(subscription.PaymentReference)
            : CreateSubscriptionTxId(subscription.StoreId, subscription.Id);

        var description = NormalizeText($"ASSINATURA {subscription.Id} {subscription.PlanNome}", 72);
        var payload = BuildPayload(new PixPayloadRequest(
            recipient.PixKey,
            subscription.PlanPreco,
            recipient.MerchantName,
            recipient.MerchantCity,
            txId,
            description));

        subscription.PaymentMode = "manual_pix";
        subscription.PaymentProvider = "brcode";
        subscription.PaymentReference = txId;
        subscription.PixKeySnapshot = recipient.PixKey;
        subscription.PixPayload = payload;
        subscription.PixGeneratedAt = DateTime.Now;

        await _db.SaveChangesAsync(ct);

        return new PixChargeResult(
            true,
            null,
            recipient.PixKey,
            recipient.Source,
            recipient.MerchantName,
            recipient.MerchantCity,
            txId,
            subscription.PlanPreco,
            description,
            payload,
            CreateQrCodeDataUrl(payload));
    }

    public static string BuildPayload(PixPayloadRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PixKey))
            throw new ArgumentException("PixKey is required.", nameof(request));
        if (request.Amount < 0)
            throw new ArgumentOutOfRangeException(nameof(request), "Amount cannot be negative.");

        var pixKey = request.PixKey.Trim();
        if (pixKey.Length > 120)
            throw new ArgumentException("PixKey is too long.", nameof(request));

        var merchantName = NormalizeText(request.MerchantName, 25);
        var merchantCity = NormalizeText(request.MerchantCity, 15);
        var txId = SanitizeTxId(request.TxId);
        var description = NormalizeText(request.Description ?? "", 72);

        var merchantAccount =
            Emv("00", PixGui) +
            Emv("01", pixKey) +
            (string.IsNullOrWhiteSpace(description) ? "" : Emv("02", description));

        var payload =
            Emv("00", "01") +
            Emv("26", merchantAccount) +
            Emv("52", "0000") +
            Emv("53", "986");

        if (request.Amount > 0)
            payload += Emv("54", request.Amount.ToString("0.00", CultureInfo.InvariantCulture));

        payload +=
            Emv("58", "BR") +
            Emv("59", merchantName) +
            Emv("60", merchantCity) +
            Emv("62", Emv("05", txId));

        var crcInput = payload + "6304";
        return crcInput + Crc16Ccitt(crcInput).ToString("X4", CultureInfo.InvariantCulture);
    }

    public static string CreateQrCodeDataUrl(string payload)
        => $"data:image/png;base64,{Convert.ToBase64String(CreateQrCodePng(payload))}";

    public static byte[] CreateQrCodePng(string payload)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
        return new PngByteQRCode(data).GetGraphic(8);
    }

    public static string CreateSubscriptionTxId(int storeId, int subscriptionId)
        => SanitizeTxId($"S{storeId}SUB{subscriptionId}");

    private async Task<PixRecipient> ResolveRecipientAsync(
        int storeId,
        int? barberId,
        string? barberName,
        Store? store,
        CancellationToken ct)
    {
        var keys = new List<string>
        {
            $"Store_{storeId}_PixKey",
            "PixKey",
            $"Store_{storeId}_PixMerchantName",
            "PixMerchantName",
            $"Store_{storeId}_PixMerchantCity",
            "PixMerchantCity"
        };

        if (barberId is > 0)
            keys.Add($"Barbeiro_{barberId}_PixKey");

        var configs = await _db.SystemConfigs.AsNoTracking()
            .Where(c => keys.Contains(c.Key))
            .ToDictionaryAsync(c => c.Key, c => c.Value, ct);

        if (barberId is > 0 &&
            configs.TryGetValue($"Barbeiro_{barberId}_PixKey", out var barberPixKey) &&
            !string.IsNullOrWhiteSpace(barberPixKey))
        {
            return new PixRecipient(
                barberPixKey.Trim(),
                "barber",
                ResolveSetting(configs, storeId, "PixMerchantName", barberName, store?.Name, _configuration["PIX_MERCHANT_NAME"], "BARBEARIA"),
                ResolveSetting(configs, storeId, "PixMerchantCity", _configuration["PIX_MERCHANT_CITY"], "BRASIL"));
        }

        if (configs.TryGetValue($"Store_{storeId}_PixKey", out var storePixKey) &&
            !string.IsNullOrWhiteSpace(storePixKey))
        {
            return new PixRecipient(
                storePixKey.Trim(),
                "store",
                ResolveSetting(configs, storeId, "PixMerchantName", store?.Name, _configuration["PIX_MERCHANT_NAME"], "BARBEARIA"),
                ResolveSetting(configs, storeId, "PixMerchantCity", _configuration["PIX_MERCHANT_CITY"], "BRASIL"));
        }

        if (configs.TryGetValue("PixKey", out var globalPixKey) &&
            !string.IsNullOrWhiteSpace(globalPixKey))
        {
            return new PixRecipient(
                globalPixKey.Trim(),
                "global",
                ResolveSetting(configs, storeId, "PixMerchantName", store?.Name, _configuration["PIX_MERCHANT_NAME"], "BARBEARIA"),
                ResolveSetting(configs, storeId, "PixMerchantCity", _configuration["PIX_MERCHANT_CITY"], "BRASIL"));
        }

        return new PixRecipient(
            "",
            "missing",
            ResolveSetting(configs, storeId, "PixMerchantName", store?.Name, _configuration["PIX_MERCHANT_NAME"], "BARBEARIA"),
            ResolveSetting(configs, storeId, "PixMerchantCity", _configuration["PIX_MERCHANT_CITY"], "BRASIL"));
    }

    private static string ResolveSetting(
        IReadOnlyDictionary<string, string> configs,
        int storeId,
        string key,
        params string?[] fallbacks)
    {
        if (configs.TryGetValue($"Store_{storeId}_{key}", out var storeValue) &&
            !string.IsNullOrWhiteSpace(storeValue))
            return storeValue;

        if (configs.TryGetValue(key, out var globalValue) &&
            !string.IsNullOrWhiteSpace(globalValue))
            return globalValue;

        return fallbacks.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "";
    }

    private static string Emv(string id, string value)
        => $"{id}{value.Length:00}{value}";

    private static ushort Crc16Ccitt(string value)
    {
        var crc = 0xFFFF;
        foreach (var b in Encoding.ASCII.GetBytes(value))
        {
            crc ^= b << 8;
            for (var i = 0; i < 8; i++)
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xFFFF;
        }

        return (ushort)crc;
    }

    private static string SanitizeTxId(string? value)
    {
        var raw = string.IsNullOrWhiteSpace(value) ? "***" : value.Trim();
        var sanitized = Regex.Replace(raw, "[^A-Za-z0-9*]", "");
        if (string.IsNullOrWhiteSpace(sanitized))
            sanitized = "***";
        return sanitized.Length > 25 ? sanitized[..25] : sanitized;
    }

    private static string NormalizeText(string? value, int maxLength)
    {
        var raw = string.IsNullOrWhiteSpace(value) ? "BRASIL" : value.Trim();
        var normalized = raw.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var ch in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (category == UnicodeCategory.NonSpacingMark)
                continue;

            var upper = char.ToUpperInvariant(ch);
            builder.Append(upper is >= 'A' and <= 'Z' or >= '0' and <= '9' or ' ' or '.' or '-' or '/'
                ? upper
                : ' ');
        }

        var collapsed = Regex.Replace(builder.ToString(), "\\s+", " ").Trim();
        if (string.IsNullOrWhiteSpace(collapsed))
            collapsed = "BRASIL";
        return collapsed.Length > maxLength ? collapsed[..maxLength].Trim() : collapsed;
    }

    private sealed record PixRecipient(
        string PixKey,
        string Source,
        string MerchantName,
        string MerchantCity);
}
