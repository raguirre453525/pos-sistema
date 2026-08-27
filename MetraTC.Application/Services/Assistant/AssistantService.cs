using Microsoft.Extensions.Configuration;

namespace MetraTC.Application.Services.Assistant;

public class AssistantService : IAssistantService
{
    private readonly IConfiguration _configuration;
    private readonly MockAssistantProvider _mockProvider;
    private readonly OpenAiAssistantProvider _openAiProvider;
    private readonly DeepSeekAssistantProvider _deepSeekProvider;

    public AssistantService(
        IConfiguration configuration,
        MockAssistantProvider mockProvider,
        OpenAiAssistantProvider openAiProvider,
        DeepSeekAssistantProvider deepSeekProvider)
    {
        _configuration = configuration;
        _mockProvider = mockProvider;
        _openAiProvider = openAiProvider;
        _deepSeekProvider = deepSeekProvider;
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

        var reply = await provider.GetResponseAsync(message, history, ct);
        return (reply, provider.Name);
    }
}
