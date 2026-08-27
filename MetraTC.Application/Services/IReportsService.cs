using MetraTC.Application.DTOs;
using MetraTC.Domain.Enums;
using static MetraTC.Application.DTOs.ReportDtos;
using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Services;

public interface IReportsService
{
    Task<IEnumerable<LowStockDto>> GetLowStockAsync(int threshold = 5);

    Task<PagedResult<SaleDto>> GetSalesAsync(
        DateTime? from,
        DateTime? to,
        PaymentMethod? paymentMethod,
        int page = 1,
        int pageSize = 20);

    Task<PagedResult<StockAuditDto>> GetStockAuditsAsync(
        Guid? productId,
        DateTime? from,
        DateTime? to,
        int page = 1,
        int pageSize = 20,
        string? reasonContains = null);

    Task<DashboardSummaryDto> GetDashboardAsync(DateTime? from, DateTime? to);
}
