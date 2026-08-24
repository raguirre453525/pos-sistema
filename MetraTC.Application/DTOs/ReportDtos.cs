using MetraTC.Domain.Enums;

namespace MetraTC.Application.DTOs;

public record PagedResult<T>
{
    public List<T> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public static class ReportDtos
{
    public record LowStockDto
    {
        public Guid Id { get; init; }
        public string Sku { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public decimal Price { get; init; }
        public int Stock { get; init; }
        public int Threshold { get; init; }
    }

    public record StockAuditDto
    {
        public Guid Id { get; init; }
        public Guid ProductId { get; init; }
        public string Sku { get; init; } = string.Empty;
        public string ProductName { get; init; } = string.Empty;
        public int Delta { get; init; }
        public int ResultingStock { get; init; }
        public string Reason { get; init; } = string.Empty;
        public DateTime AdjustedAt { get; init; }
    }
}
