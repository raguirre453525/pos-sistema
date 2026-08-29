using MetraTC.Domain.Entities;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.DTOs;

public static class PromotionDtos
{
    public record PromotionLineDto(Guid ProductId, int Quantity);
    public record PromotionProductDto(Guid ProductId, string ProductName, string Sku, decimal UnitPrice, int Quantity, decimal LineTotal);

    public record CreatePromotionDto(
        string Name,
        string? Description,
        PromotionType Type,
        bool IsActive,
        DateTime? ValidFrom,
        DateTime? ValidTo,
        decimal? ComboPrice,
        decimal? DiscountPercentage,
        List<PromotionLineDto>? Lines,
        List<Guid>? ProductIds // compat: si viene lista vieja de Guids, se convierte a qty 1
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
        List<PromotionLineDto>? Lines,
        List<Guid>? ProductIds
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
        List<PromotionProductDto> Lines,
        List<ProductDto> Products, // compat: productos aplanados
        decimal? TotalOriginalPrice,
        decimal? SavingAmount,
        decimal? SavingPercent,
        bool IsCurrentlyActive
    );
}
