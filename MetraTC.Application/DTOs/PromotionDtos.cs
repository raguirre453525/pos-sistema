using MetraTC.Domain.Entities;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.DTOs;

public static class PromotionDtos
{
    public record CreatePromotionDto(
        string Name,
        string? Description,
        PromotionType Type,
        bool IsActive,
        DateTime? ValidFrom,
        DateTime? ValidTo,
        decimal? ComboPrice,
        decimal? DiscountPercentage,
        List<Guid> ProductIds
    );

    public record UpdatePromotionDto(
        string Name,
        string? Description,
        PromotionType Type,
        bool IsActive,
        DateTime? ValidFrom,
        DateTime? ValidTo,
        decimal? ComboPrice,
        decimal? DiscountPercentage,
        List<Guid> ProductIds
    );

    public record PromotionDto(
        Guid Id,
        string Name,
        string? Description,
        PromotionType Type,
        bool IsActive,
        DateTime? ValidFrom,
        DateTime? ValidTo,
        decimal? ComboPrice,
        decimal? DiscountPercentage,
        List<ProductDto> Products,
        decimal? TotalOriginalPrice,
        decimal? SavingAmount,
        decimal? SavingPercent,
        bool IsCurrentlyActive
    );
}
