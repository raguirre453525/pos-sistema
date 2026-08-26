namespace MetraTC.Application.DTOs;

public static class AssistantDtos
{
    public record ChatMessageDto(string Role, string Content);

    public record ChatRequestDto(string Message, List<ChatMessageDto>? History);

    public record ChatResponseDto(string Reply, string Provider);

    public record ProvidersResponseDto(string Current, string[] Available);
}
