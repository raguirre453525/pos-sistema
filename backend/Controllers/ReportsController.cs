using System.Security.Claims;
using MetraTC.Application.Services;
using MetraTC.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportsService _reports;

    public ReportsController(IReportsService reports)
    {
        _reports = reports;
    }

    private bool TryGetBusinessIdForReports(out Guid? businessId)
    {
        businessId = null;
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase))
            return true; // global
        var bid = User.FindFirst("businessId")?.Value;
        if (string.IsNullOrWhiteSpace(bid)) return false;
        if (!Guid.TryParse(bid, out var parsed) || parsed == Guid.Empty) return false;
        businessId = parsed;
        return true;
    }

    /// <summary>Lista productos con stock bajo el umbral.</summary>
    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStock([FromQuery] int threshold = 5)
    {
        if (!TryGetBusinessIdForReports(out var businessId)) return Forbid();
        var items = await _reports.GetLowStockAsync(threshold, businessId);
        return Ok(items);
    }

    /// <summary>Historial de ventas con filtros opcionales y paginación.</summary>
    [HttpGet("sales")]
    public async Task<IActionResult> GetSales(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (!TryGetBusinessIdForReports(out var businessId)) return Forbid();
        var result = await _reports.GetSalesAsync(from, to, paymentMethod, page, pageSize, businessId);
        return Ok(result);
    }

    /// <summary>Historial de ajustes de stock (auditoría).</summary>
    [HttpGet("stock-audits")]
    public async Task<IActionResult> GetStockAudits(
        [FromQuery] Guid? productId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? reasonContains = null)
    {
        if (!TryGetBusinessIdForReports(out var businessId)) return Forbid();
        var result = await _reports.GetStockAuditsAsync(productId, from, to, page, pageSize, reasonContains, businessId);
        return Ok(result);
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        if (!TryGetBusinessIdForReports(out var businessId)) return Forbid();
        var result = await _reports.GetDashboardAsync(from, to, businessId);
        return Ok(result);
    }
}
