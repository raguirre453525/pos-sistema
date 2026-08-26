using Microsoft.Extensions.Configuration;

namespace MetraTC.Application.Services.Assistant;

public class AssistantService : IAssistantService
{
    private readonly IConfiguration _configuration;
    private readonly MockAssistantProvider _mockProvider;
    private readonly OpenAiAssistantProvider _openAiProvider;

    public AssistantService(
        IConfiguration configuration,
        MockAssistantProvider mockProvider,
        OpenAiAssistantProvider openAiProvider)
    {
        _configuration = configuration;
        _mockProvider = mockProvider;
        _openAiProvider = openAiProvider;
    }

    public string CurrentProvider =>
        (_configuration["Assistant:Provider"] ?? "mock").Trim().ToLowerInvariant();

    public string[] AvailableProviders => new[] { "mock", "openai", "gemini" };

    public async Task<(string Reply, string Provider)> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct)
    {
        var providerName = CurrentProvider;

        IAssistantProvider provider = providerName switch
        {
            "mock" => _mockProvider,
            "openai" => _openAiProvider,
            "gemini" => throw new NotSupportedException("Provider 'gemini' aún no implementado. Usá 'mock' u 'openai'."),
            _ => throw new InvalidOperationException($"Provider '{providerName}' inválido. Valores válidos: mock, openai.")
        };

        // Early validation for openai without key -> throw 400 via controller mapping
        if (providerName == "openai" && string.IsNullOrWhiteSpace(_configuration["Assistant:OpenAI:ApiKey"]))
        {
            throw new InvalidOperationException("Configura Assistant:OpenAI:ApiKey");
        }

        var reply = await provider.GetResponseAsync(message, history, ct);
        return (reply, provider.Name);
    }
}
