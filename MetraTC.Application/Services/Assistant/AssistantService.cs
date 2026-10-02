using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using static MetraTC.Application.DTOs.AssistantDtos;

namespace MetraTC.Application.Services.Assistant;

public class AssistantService : IAssistantService
{
    private readonly record struct ProposalGateKey(Guid BusinessId, Guid UserId);

    private sealed class ProposalGate
    {
        public SemaphoreSlim Semaphore { get; } = new(1, 1);
        public int References { get; set; }
    }

    private static readonly object ProposalGatesSync = new();
    // ponytail: this protects one API process only; multi-instance deployments need distributed idempotency/locking.
    private static readonly Dictionary<ProposalGateKey, ProposalGate> ProposalGates = [];

    private readonly IConfiguration _configuration;
    private readonly MockAssistantProvider _mockProvider;
    private readonly OpenAiAssistantProvider _openAiProvider;
    private readonly DeepSeekAssistantProvider _deepSeekProvider;
    private readonly OpenRouterAssistantProvider _openRouterProvider;
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
        OpenRouterAssistantProvider openRouterProvider,
        AssistantInventoryContext inventoryContext,
        AssistantProposalService proposalService,
        IMemoryCache cache,
        ILogger<AssistantService> logger)
    {
        _configuration = configuration;
        _mockProvider = mockProvider;
        _openAiProvider = openAiProvider;
        _deepSeekProvider = deepSeekProvider;
        _openRouterProvider = openRouterProvider;
        _inventoryContext = inventoryContext;
        _proposalService = proposalService;
        _cache = cache;
        _logger = logger;
    }

    public string CurrentProvider =>
        (_configuration["Assistant:Provider"] ?? "deepseek").Trim().ToLowerInvariant();

    public string[] AvailableProviders => new[] { "mock", "openai", "deepseek", "openrouter", "gemini" };

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
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        if (CurrentProvider == "openrouter") budget.CancelAfter(OpenRouterAssistantProvider.RequestBudget);
        _cache.TryGetValue<ProposalResponse>(GetCacheKey(businessId, userId), out var proposalAtRequestStart);
        try
        {
            return await WithProposalGateAsync(businessId, userId, () => GetResponseUnderProposalGateAsync(
                message, history, images, businessId, userId, canConfirmStockAdjustments, proposalAtRequestStart, budget.Token), budget.Token);
        }
        catch (OperationCanceledException ex) when (!ct.IsCancellationRequested && budget.IsCancellationRequested)
        {
            throw new TimeoutException("OpenRouter no completó la respuesta dentro del tiempo permitido.", ex);
        }
    }

    private async Task<(string Reply, string Provider, ProposalResponse? Proposal)> GetResponseUnderProposalGateAsync(
        string message,
        IReadOnlyList<ChatMessage> history,
        IReadOnlyList<AssistantImage> images,
        Guid businessId,
        Guid userId,
        bool canConfirmStockAdjustments,
        ProposalResponse? proposalAtRequestStart,
        CancellationToken ct)
    {
        var cacheKey = GetCacheKey(businessId, userId);
        if (images.Count > 0) InvalidatePendingProposalForImage(_cache, businessId, userId);

        var providerName = CurrentProvider;

        IAssistantProvider provider = providerName switch
        {
            "mock" => _mockProvider,
            "openai" => _openAiProvider,
            "deepseek" => _deepSeekProvider,
            "openrouter" => _openRouterProvider,
            "gemini" => throw new NotSupportedException("Provider 'gemini' aún no implementado. Usá 'mock', 'openai' o 'deepseek'."),
            _ => throw new InvalidOperationException($"Provider '{providerName}' inválido. Valores válidos: mock, openai, deepseek, openrouter.")
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
        if (providerName == "openrouter") OpenRouterAssistantProvider.ValidateConfiguration(_configuration);

        string inventoryContext;
        try
        {
            inventoryContext = await _inventoryContext.GetInventoryContextAsync(businessId, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "No se pudo obtener contexto de inventario");
            inventoryContext = "Inventario no disponible momentáneamente.";
        }
        if (images.Count > 0)
        {
            if (providerName is not ("deepseek" or "openrouter"))
                throw new NotSupportedException("Las imágenes requieren DeepSeek u OpenRouter.");

            using var imageBudget = CancellationTokenSource.CreateLinkedTokenSource(ct);
            imageBudget.CancelAfter(providerName == "openrouter" ? OpenRouterAssistantProvider.RequestBudget : DeepSeekAssistantProvider.RequestBudget);
            try
            {
                if (string.IsNullOrWhiteSpace(message) || AssistantProductExtractor.HasInventoryWriteIntent(message))
                {
                    var imageProposal = await _proposalService.BuildImageProposalAsync(message, images, businessId, imageBudget.Token);
                    if (imageProposal.IsProductList)
                    {
                        if (imageProposal.Proposal is { Proposals.Count: > 0 } imageResponseProposal)
                        {
                            _cache.Set(cacheKey, imageResponseProposal, TimeSpan.FromMinutes(10));
                            return (imageResponseProposal.NaturalReply, provider.Name, imageResponseProposal);
                        }

                        return (imageProposal.Reply ?? "No pude preparar una propuesta con esta imagen. No se realizó ningún cambio.", provider.Name, null);
                    }
                }

                var imageReply = providerName == "openrouter"
                    ? await _openRouterProvider.GetResponseAsync(message, history, inventoryContext, images, imageBudget.Token)
                    : await _deepSeekProvider.GetResponseAsync(message, history, inventoryContext, images, imageBudget.Token);
                return (imageReply, provider.Name, null);
            }
            catch (OperationCanceledException ex) when (!ct.IsCancellationRequested)
            {
                throw new TimeoutException($"{providerName} no completó la respuesta dentro del tiempo permitido.", ex);
            }
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
            if (IsConfirmation(message) && !IsSamePendingProposal(pending, proposalAtRequestStart))
                return ("La propuesta cambió mientras esperaba esta confirmación. Revisá la propuesta actual antes de confirmar.", provider.Name, pending);

            if (pending.HasMissingData && IsConfirmation(message) && !AssistantProductExtractor.HasStockMovementIntent(message))
            {
                var missingMsg = pending.NaturalReply + "\n\nFaltan datos obligatorios, no puedo ejecutar aún. Decime los datos que faltan.";
                return (missingMsg, provider.Name, pending);
            }

            if (CanExecuteConfirmedProposal(message, pending, canConfirmStockAdjustments))
            {
                if (!_cache.TryGetValue<ProposalResponse>(cacheKey, out var proposalInCache) ||
                    !IsSamePendingProposal(proposalInCache, pending))
                    return ("La propuesta cambió mientras esperaba esta confirmación. Revisá la propuesta actual antes de confirmar.", provider.Name, proposalInCache);

                string result;
                try
                {
                    result = await _proposalService.ExecuteAsync(pending, businessId, ct);
                }
                catch (AssistantProposalOutcomeUnknownException)
                {
                    _cache.Remove(cacheKey);
                    throw;
                }
                _cache.Remove(cacheKey);
                var successReply = $"✅ Ejecutado:\n{result}";
                return (successReply, provider.Name, null);
            }

            if (IsConfirmation(message) && !AssistantProductExtractor.HasStockMovementIntent(message))
                return ("Solo un administrador puede confirmar ajustes de stock. La propuesta sigue pendiente.", provider.Name, pending);

            // Pending has missing data -> try to patch with new message before any LLM fallback
            if (pending.HasMissingData)
            {
                ProposalResponse? patched = null;
                try
                {
                    patched = await _proposalService.TryPatchPendingAsync(pending, message, history, inventoryContext, businessId, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException and not TimeoutException and not HttpRequestException)
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
        catch (Exception ex) when (ex is not OperationCanceledException and not TimeoutException and not HttpRequestException)
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

    public static async Task<T> WithProposalGateAsync<T>(Guid businessId, Guid userId, Func<Task<T>> action, CancellationToken ct)
    {
        var key = new ProposalGateKey(businessId, userId);
        ProposalGate gate;
        lock (ProposalGatesSync)
        {
            if (!ProposalGates.TryGetValue(key, out gate!))
                ProposalGates[key] = gate = new ProposalGate();
            gate.References++;
        }

        try
        {
            await gate.Semaphore.WaitAsync(ct);
        }
        catch
        {
            ReleaseProposalGate(key, gate, releaseSemaphore: false);
            throw;
        }

        try
        {
            return await action();
        }
        finally
        {
            ReleaseProposalGate(key, gate, releaseSemaphore: true);
        }
    }

    private static void ReleaseProposalGate(ProposalGateKey key, ProposalGate gate, bool releaseSemaphore)
    {
        lock (ProposalGatesSync)
        {
            if (releaseSemaphore) gate.Semaphore.Release();
            if (--gate.References == 0)
            {
                ProposalGates.Remove(key);
                gate.Semaphore.Dispose();
            }
        }
    }

    public static bool InvalidatePendingProposalForImage(IMemoryCache cache, Guid businessId, Guid userId)
    {
        var key = GetCacheKey(businessId, userId);
        var hadProposal = cache.TryGetValue<ProposalResponse>(key, out _);
        cache.Remove(key);
        return hadProposal;
    }

    public static bool IsSamePendingProposal(ProposalResponse? current, ProposalResponse? observedAtRequestStart) =>
        current is not null && ReferenceEquals(current, observedAtRequestStart);

    public static bool CanExecuteProposal(ProposalResponse proposal, bool canConfirmStockAdjustments) =>
        canConfirmStockAdjustments ||
        !proposal.Proposals.Any(p => p.StockDelta is { } delta && delta != 0m);

    public static bool CanExecuteConfirmedProposal(string message, ProposalResponse proposal, bool canConfirmStockAdjustments) =>
        IsConfirmation(message) &&
        !AssistantProductExtractor.HasStockMovementIntent(message) &&
        proposal.NeedsConfirmation &&
        !proposal.HasMissingData &&
        proposal.Proposals.All(p => p.MissingFields.Count == 0) &&
        proposal.Proposals.Count > 0 &&
        CanExecuteProposal(proposal, canConfirmStockAdjustments);
}
