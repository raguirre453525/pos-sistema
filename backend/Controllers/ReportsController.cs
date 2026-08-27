using MetraTC.Application.Services;
using MetraTC.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly IReportsService _reportsService;

    public ReportsController(IReportsService reportsService)
    {
        _reportsService = reportsService;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var result = await _reportsService.GetDashboardAsync(from, to);
        return Ok(result);
    }

    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStock([FromQuery] int threshold = 5)
    {
        var result = await _reportsService.GetLowStockAsync(threshold);
        return Ok(result);
    }

    [HttpGet("sales")]
    public async Task<IActionResult> GetSales(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? paymentMethod,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        PaymentMethod? pm = null;
        if (paymentMethod.HasValue)
            pm = (PaymentMethod)paymentMethod.Value;

        var result = await _reportsService.GetSalesAsync(from, to, pm, page, pageSize);
        return Ok(result);
    }

    [HttpGet("stock-audits")]
    public async Task<IActionResult> GetStockAudits(
        [FromQuery] Guid? productId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? reasonContains = null)
    {
        var result = await _reportsService.GetStockAuditsAsync(productId, from, to, page, pageSize, reasonContains);
        return Ok(result);
    }
}
