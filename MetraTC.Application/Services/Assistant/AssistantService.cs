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

    private const string CacheKey = "assistant:lastProposal";

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
        (_configuration["Assistant:Provider"] ?? "mock").Trim().ToLowerInvariant();

    public string[] AvailableProviders => new[] { "mock", "openai", "deepseek", "gemini" };

    private static bool IsConfirmation(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        var normalized = message.Trim().ToLowerInvariant();
        // Remove leading punctuation/spaces
        normalized = Regex.Replace(normalized, @"^[^\p{L}\p{N}]+", "");
        return Regex.IsMatch(normalized, @"^(sí|si|dale|confirmo|hacelo|hace|ejecuta|ejecutá|ok|perfecto)\b");
    }

    public async Task<(string Reply, string Provider, ProposalResponse? Proposal)> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct)
    {
        var providerName = CurrentProvider;

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

        if (providerName == "deepseek" && string.IsNullOrWhiteSpace(_configuration["Assistant:DeepSeek:ApiKey"]))
        {
            throw new InvalidOperationException("Configura Assistant:DeepSeek:ApiKey");
        }

        string inventoryContext;
        try
        {
            inventoryContext = await _inventoryContext.GetInventoryContextAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo obtener contexto de inventario");
            inventoryContext = "Inventario no disponible momentáneamente.";
        }

        // Check pending proposal for confirmation flow
        if (_cache.TryGetValue<ProposalResponse>(CacheKey, out var pending) && pending != null)
        {
            if (IsConfirmation(message))
            {
                if (pending.HasMissingData)
                {
                    var missingMsg = pending.NaturalReply + "\n\nFaltan datos obligatorios, no puedo ejecutar aún. Decime los datos que faltan.";
                    return (missingMsg, provider.Name, pending);
                }
                // Execute
                var result = await _proposalService.ExecuteAsync(pending, ct);
                _cache.Remove(CacheKey);
                // Refresh inventory context after execution for reply context? Keep simple
                var successReply = $"✅ Ejecutado:\n{result}";
                return (successReply, provider.Name, null);
            }
            // If not confirmation, we fall through to try building a new proposal (correction loop).
            // If the new message yields a proposal, it will overwrite pending.
        }

        // Try to build proposal (detection via extractor)
        ProposalResponse? proposal = null;
        try
        {
            proposal = await _proposalService.BuildProposalAsync(message, history, inventoryContext, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "BuildProposal failed");
            proposal = null;
        }

        if (proposal != null && proposal.Proposals.Count > 0)
        {
            // Cache it (even with missing data, to allow correction loop)
            _cache.Set(CacheKey, proposal, TimeSpan.FromMinutes(10));
            return (proposal.NaturalReply, provider.Name, proposal);
        }

        // No proposal -> normal chat with LLM (if user was trying to correct but extractor returned empty, we keep pending)
        // Do not clear pending here; pending remains for next confirmation unless overwritten by new proposal
        var reply = await provider.GetResponseAsync(message, history, inventoryContext, ct);
        return (reply, provider.Name, null);
    }
}
