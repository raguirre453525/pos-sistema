using static MetraTC.Application.DTOs.AssistantDtos;

namespace MetraTC.Application.Services.Assistant;

public interface IAssistantService
{
    string CurrentProvider { get; }
    string[] AvailableProviders { get; }
    Task<(string Reply, string Provider, ProposalResponse? Proposal)> GetResponseAsync(
        string message,
        IReadOnlyList<ChatMessage> history,
        IReadOnlyList<AssistantImage> images,
        Guid businessId,
        Guid userId,
        bool canConfirmStockAdjustments,
        CancellationToken ct);
}
