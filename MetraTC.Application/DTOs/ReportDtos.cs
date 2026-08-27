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

public record DashboardSummaryDto
{
    public int SalesCount { get; init; }
    public decimal TotalRevenue { get; init; }
    public int ProductsSoldQuantity { get; init; }
    public decimal TicketAverage { get; init; }
    public int LowStockCount { get; init; }
    public List<DailySaleDto> DailySales { get; init; } = new();
    public List<CategorySaleDto> SalesByCategory { get; init; } = new();
    public List<TopProductDto> TopProducts { get; init; } = new();
    public List<SaleDtos.SaleDto> RecentSales { get; init; } = new();
}

public record DailySaleDto
{
    public DateTime Date { get; init; }
    public decimal Total { get; init; }
    public int Count { get; init; }
}

public record CategorySaleDto
{
    public string Category { get; init; } = string.Empty;
    public decimal Total { get; init; }
    public int Quantity { get; init; }
}

public record TopProductDto
{
    public Guid ProductId { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public decimal Revenue { get; init; }
}
