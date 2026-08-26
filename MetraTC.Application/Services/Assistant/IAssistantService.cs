namespace MetraTC.Application.Services.Assistant;

public interface IAssistantService
{
    string CurrentProvider { get; }
    string[] AvailableProviders { get; }
    Task<(string Reply, string Provider)> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct);
}
