using System;
using System.Collections.Generic;
using System.Text;

namespace MetraTC.Application.DTOs
{
    public static class ProductDtos
    {
        public record ProductDto(
            Guid Id,
            string Sku,
            string? Barcode,
            string Name,
            string? Description,
            decimal Price,
            int Stock,
            string? ImageUrl,
            string? Unit,
            int? MinStock
        );

        public record StockAdjustmentDto(
            int Delta,
            string Reason
        );

        public record StockAdjustmentResponseDto(
            ProductDto Product,
            int Delta,
            int ResultingStock,
            string Reason,
            DateTime AdjustedAt
        );

        public record CreateProductDto(
            string Sku,
            string Name,
            decimal Price,
            string? Barcode,
            string? Description,
            string? ImageUrl,
            string? Unit,
            int? MinStock
        );

        public record UpdateProductDto(
            string Name,
            decimal Price,
            string? Description,
            string? ImageUrl,
            string? Unit,
            int? MinStock
        );

        public record ProductPriceHistoryDto(
            Guid Id,
            Guid ProductId,
            decimal OldPrice,
            decimal NewPrice,
            DateTime ChangedAt,
            string? Reason,
            decimal ChangePercent
        );

        public record BulkPriceAdjustmentDto(
            Guid? CategoryId,
            List<Guid>? ProductIds,
            decimal? Percentage,
            decimal? FixedAmount,
            string Reason
        );

        public record BulkPriceAdjustmentResultDto(
            int AffectedCount,
            List<ProductPriceHistoryDto> Histories
        );
    };
}
