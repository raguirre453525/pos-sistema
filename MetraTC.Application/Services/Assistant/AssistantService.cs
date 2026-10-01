using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using static MetraTC.Application.DTOs.AssistantDtos;

namespace MetraTC.Application.Services.Assistant;

public class AssistantService : IAssistantService
{
    private readonly IConfiguration _configuration;
    private readonly MockAssistantProvider _mockProvider;
    private readonly OpenAiAssistantProvider _openAiProvider;
    private readonly DeepSeekAssistantProvider _deepSeekProvider;
    private readonly AssistantInventoryContext _inventoryContext;
    private readonly AssistantProposalService _proposalService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<AssistantService> _logger;

    private static string GetCacheKey(Guid businessId, Guid userId)
        => $"assistant:lastProposal:{businessId}:{userId}";

    public AssistantService(
        IConfiguration configuration,
        MockAssistantProvider mockProvider,
        OpenAiAssistantProvider openAiProvider,
        DeepSeekAssistantProvider deepSeekProvider,
        AssistantInventoryContext inventoryContext,
        AssistantProposalService proposalService,
        IMemoryCache cache,
        ILogger<AssistantService> logger)
    {
        _configuration = configuration;
        _mockProvider = mockProvider;
        _openAiProvider = openAiProvider;
        _deepSeekProvider = deepSeekProvider;
        _inventoryContext = inventoryContext;
        _proposalService = proposalService;
        _cache = cache;
        _logger = logger;
    }

    public string CurrentProvider =>
        (_configuration["Assistant:Provider"] ?? "deepseek").Trim().ToLowerInvariant();

    public string[] AvailableProviders => new[] { "mock", "openai", "deepseek", "gemini" };

    private static bool IsConfirmation(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        var normalized = message.Trim().ToLowerInvariant();
        // Remove leading punctuation/spaces
        normalized = Regex.Replace(normalized, @"^[^\p{L}\p{N}]+", "");
        return Regex.IsMatch(normalized, @"^(sí|si|dale|confirmo|confirmar|confirmado|hacelo|hace|ejecuta|ejecutá|ok|perfecto)\b");
    }

    public async Task<(string Reply, string Provider, ProposalResponse? Proposal)> GetResponseAsync(
        string message,
        IReadOnlyList<ChatMessage> history,
        IReadOnlyList<AssistantImage> images,
        Guid businessId,
        Guid userId,
        bool canConfirmStockAdjustments,
        CancellationToken ct)
    {
        var providerName = CurrentProvider;
        var cacheKey = GetCacheKey(businessId, userId);

        IAssistantProvider provider = providerName switch
        {
            "mock" => _mockProvider,
            "openai" => _openAiProvider,
            "deepseek" => _deepSeekProvider,
            "gemini" => throw new NotSupportedException("Provider 'gemini' aún no implementado. Usá 'mock', 'openai' o 'deepseek'."),
            _ => throw new InvalidOperationException($"Provider '{providerName}' inválido. Valores válidos: mock, openai, deepseek.")
        };

        // Early validation for providers without key -> throw 400 via controller mapping
        if (providerName == "openai" && string.IsNullOrWhiteSpace(_configuration["Assistant:OpenAI:ApiKey"]))
        {
            throw new InvalidOperationException("Configura Assistant:OpenAI:ApiKey");
        }

        if (providerName == "deepseek" && string.IsNullOrWhiteSpace(DeepSeekAssistantProvider.GetApiKey(_configuration)))
        {
            throw new InvalidOperationException("Configura Assistant:DeepSeek:ApiKey");
        }

        string inventoryContext;
        try
        {
            inventoryContext = await _inventoryContext.GetInventoryContextAsync(businessId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo obtener contexto de inventario");
            inventoryContext = "Inventario no disponible momentáneamente.";
        }

        if (images.Count > 0)
        {
            if (providerName != "deepseek")
                throw new NotSupportedException("Las imágenes requieren que el proveedor configurado sea DeepSeek.");

            var imageReply = await _deepSeekProvider.GetResponseAsync(message, history, inventoryContext, images, ct);
            return (imageReply, provider.Name, null);
        }

        // Informational questions must not enter proposal, patch, or confirmation flows.
        if (AssistantProductExtractor.IsReadOnlyRequest(message))
        {
            var readOnlyReply = await provider.GetResponseAsync(message, history, inventoryContext, ct);
            return (readOnlyReply, provider.Name, null);
        }

        // Check pending proposal for confirmation flow
        if (_cache.TryGetValue<ProposalResponse>(cacheKey, out var pending) && pending != null)
        {
            if (IsConfirmation(message) && !AssistantProductExtractor.HasStockMovementIntent(message))
            {
                if (pending.HasMissingData)
                {
                    var missingMsg = pending.NaturalReply + "\n\nFaltan datos obligatorios, no puedo ejecutar aún. Decime los datos que faltan.";
                    return (missingMsg, provider.Name, pending);
                }
                if (!CanExecuteProposal(pending, canConfirmStockAdjustments))
                    return ("Solo un administrador puede confirmar ajustes de stock. La propuesta sigue pendiente.", provider.Name, pending);

                // Execute
                var result = await _proposalService.ExecuteAsync(pending, businessId, ct);
                _cache.Remove(cacheKey);
                var successReply = $"✅ Ejecutado:\n{result}";
                return (successReply, provider.Name, null);
            }

            // Pending has missing data -> try to patch with new message before any LLM fallback
            if (pending.HasMissingData)
            {
                ProposalResponse? patched = null;
                try
                {
                    patched = await _proposalService.TryPatchPendingAsync(pending, message, history, inventoryContext, businessId, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "TryPatchPending failed");
                    patched = null;
                }

                if (patched != null)
                {
                    // If patched is complete it still needs confirmation, don't execute automatically
                    _cache.Set(cacheKey, patched, TimeSpan.FromMinutes(10));
                    return (patched.NaturalReply, provider.Name, patched);
                }

                // Patched null: user didn't provide patchable data nor new valid product -> don't hallucinante via LLM
                // Also try normal BuildProposal: if user sent a totally new product, BuildProposal will handle it below.
                // But if BuildProposal also yields nothing, we must return reminder instead of LLM.
                // We defer to BuildProposal below; if that also returns null we will return reminder at fallback.
                // Mark that we are in pending-missing state to block LLM later.
            }
            // If not confirmation and not patched, fall through to try building a new proposal (correction loop).
            // If the new message yields a proposal, it will overwrite pending.
        }

        // Try to build proposal (detection via extractor)
        ProposalResponse? proposal = null;
        try
        {
            proposal = await _proposalService.BuildProposalAsync(message, history, inventoryContext, businessId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "BuildProposal failed");
            proposal = null;
        }

        if (proposal != null && proposal.Proposals.Count > 0)
        {
            // Cache it (even with missing data, to allow correction loop)
            _cache.Set(cacheKey, proposal, TimeSpan.FromMinutes(10));
            return (proposal.NaturalReply, provider.Name, proposal);
        }

        // No proposal -> normal chat with LLM (if user was trying to correct but extractor returned empty, we keep pending)
        // Block hallucination: if pending has missing data and no new proposal was built, don't call LLM
        if (_cache.TryGetValue<ProposalResponse>(cacheKey, out var stillPending) && stillPending != null && stillPending.HasMissingData)
        {
            var reminder = stillPending.NaturalReply + "\n\nDecime los datos exactos que faltan (ej: \"SKU YERBA01 precio 1700\").";
            return (reminder, provider.Name, stillPending);
        }
        // Do not clear pending here; pending remains for next confirmation unless overwritten by new proposal
        var reply = await provider.GetResponseAsync(message, history, inventoryContext, ct);
        return (reply, provider.Name, null);
    }

    public static bool CanExecuteProposal(ProposalResponse proposal, bool canConfirmStockAdjustments) =>
        canConfirmStockAdjustments ||
        !proposal.Proposals.Any(p => p.StockDelta is { } delta && delta != 0m);
}
