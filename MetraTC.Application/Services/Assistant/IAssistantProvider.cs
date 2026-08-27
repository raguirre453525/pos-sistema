namespace MetraTC.Application.Services.Assistant;

public interface IAssistantProvider
{
    string Name { get; }
    Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, CancellationToken ct);

    // Compatibilidad: overload sin inventoryContext delega al nuevo método
    Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct)
        => GetResponseAsync(message, history, string.Empty, ct);
}
