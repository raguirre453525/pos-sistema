namespace MetraTC.Application.DTOs;

public static class AssistantDtos
{
    public record ChatMessageDto(string Role, string Content);

    public record ChatRequestDto(string Message, List<ChatMessageDto>? History);

    public record ChatResponseDto(string Reply, string Provider, ProposalResponse? Proposal = null);

    public record ProvidersResponseDto(string Current, string[] Available);

    public record ProductProposal(
        string Name,
        string? Sku,
        decimal? Price,
        decimal? StockDelta,
        string? Barcode,
        string? Description,
        List<string>? CategoryNames,
        bool Exists,
        Guid? ExistingId,
        decimal? CurrentPrice,
        decimal? CurrentStock,
        List<string> MissingFields,
        string Action // "create" | "restock" | "restock+price_update"
    );

    public record ProposalResponse(
        List<ProductProposal> Proposals,
        string NaturalReply,
        bool NeedsConfirmation,
        bool HasMissingData
    );
}
