using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace MetraTC.Application.Services.Assistant;

public class AssistantService : IAssistantService
{
    private readonly IConfiguration _configuration;
    private readonly MockAssistantProvider _mockProvider;
    private readonly OpenAiAssistantProvider _openAiProvider;
    private readonly DeepSeekAssistantProvider _deepSeekProvider;
    private readonly AssistantInventoryContext _inventoryContext;
    private readonly ILogger<AssistantService> _logger;

    public AssistantService(
        IConfiguration configuration,
        MockAssistantProvider mockProvider,
        OpenAiAssistantProvider openAiProvider,
        DeepSeekAssistantProvider deepSeekProvider,
        AssistantInventoryContext inventoryContext,
        ILogger<AssistantService> logger)
    {
        _configuration = configuration;
        _mockProvider = mockProvider;
        _openAiProvider = openAiProvider;
        _deepSeekProvider = deepSeekProvider;
        _inventoryContext = inventoryContext;
        _logger = logger;
    }

    public string CurrentProvider =>
        (_configuration["Assistant:Provider"] ?? "mock").Trim().ToLowerInvariant();

    public string[] AvailableProviders => new[] { "mock", "openai", "deepseek", "gemini" };

    public async Task<(string Reply, string Provider)> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct)
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

        var reply = await provider.GetResponseAsync(message, history, inventoryContext, ct);
        return (reply, provider.Name);
    }
}
