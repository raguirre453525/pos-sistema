using MetraTC.Domain.Enums;

namespace MetraTC.Application.DTOs;

public static class SaleDtos
{
    public record CreateSaleDto(
        List<CreateSaleItemDto> Items,
        PaymentMethod PaymentMethod
    );

    public record CreateSaleItemDto(
        Guid ProductId,
        int Quantity
    );

    public record SaleDto
    {
        public Guid Id { get; init; }
        public DateTime Date { get; init; }
        public string PaymentMethod { get; init; } = string.Empty;
        public decimal Total { get; init; }
        public List<SaleItemDto> Items { get; init; } = new();
    }

    public record SaleItemDto
    {
        public Guid ProductId { get; init; }
        public string Sku { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public int Quantity { get; init; }
        public decimal UnitPrice { get; init; }
        public decimal Subtotal { get; init; }
    }
}
