namespace MetraTC.Application.DTOs;

public static class CategoryDtos
{
    public record CategoryDto(
        Guid Id,
        string Name,
        string? Description,
        bool IsActive,
        int ProductCount = 0
    );

    public record CreateCategoryDto(
        string Name,
        string? Description
    );

    public record UpdateCategoryDto(
        string Name,
        string? Description
    );
}
