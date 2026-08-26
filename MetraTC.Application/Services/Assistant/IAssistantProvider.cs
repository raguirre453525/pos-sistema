namespace MetraTC.Application.Services.Assistant;

public interface IAssistantProvider
{
    string Name { get; }
    Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct);
}
