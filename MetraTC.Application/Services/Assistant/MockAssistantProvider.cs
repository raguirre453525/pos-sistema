using Microsoft.Extensions.Configuration;

namespace MetraTC.Application.Services.Assistant;

public class MockAssistantProvider : IAssistantProvider
{
    public string Name => "mock";
    private readonly string _prefix;

    public MockAssistantProvider(IConfiguration configuration)
    {
        _prefix = configuration["Assistant:Mock:Prefix"] ?? "Mock";
    }

    public Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct)
    {
        // Useful simulated response for POS domain
        var reply = $"{_prefix}: recibí \"{message}\" — puedo ayudarte con stock, productos, ventas y reportes. " +
                    "Probá preguntarme por productos con stock bajo, ventas del día o cómo ajustar inventario. " +
                    "(Configurá Assistant:Provider=openai y tu ApiKey para respuestas reales con IA).";
        return Task.FromResult(reply);
    }
}
