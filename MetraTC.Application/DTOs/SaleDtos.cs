using MetraTC.Domain.Enums;

namespace MetraTC.Application.DTOs;

public static class SaleDtos
{
    public record CreateSaleDto(
        List<CreateSaleItemDto> Items,
        PaymentMethod PaymentMethod,
        Guid? CustomerId = null,
        bool IsCredit = false,
        DateTime? DueDate = null,
        int? DueDays = null
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
        public Guid? CustomerId { get; init; }
        public bool IsCredit { get; init; }
        public decimal PaidAmount { get; init; }
        public DateTime? DueDate { get; init; }
        public DateTime? PaidAt { get; init; }
        public string CreditStatus { get; init; } = string.Empty;
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
