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
            int Stock
        );

        public record CreateProductDto(
            string Sku,
            string Name,
            decimal Price,
            int Stock,
            string? Barcode,
            string? Description
        );

        public record UpdateProductDto(
            string Name,
            decimal Price,
            int Stock,
            string? Description
        );
    };
}
