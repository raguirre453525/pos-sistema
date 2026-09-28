using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/admin/metrics")]
[Authorize(Roles = "SuperAdmin")]
public class AdminMetricsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminMetricsController(ApplicationDbContext context)
    {
        _context = context;
    }

    public record BusinessMetricsDto(
        Guid Id,
        string Name,
        bool IsActive,
        string? Cuit,
        int UsersCount,
        int TotalSales,
        decimal TotalRevenue,
        DateTime CreatedAt
    );

    public record AdminMetricsDto(
        int TotalBusinesses,
        int ActiveBusinesses,
        int InactiveBusinesses,
        int TotalUsers,
        int TotalSales,
        decimal TotalRevenue,
        IReadOnlyList<BusinessMetricsDto> Businesses
    );

    [HttpGet]
    public async Task<IActionResult> GetMetrics()
    {
        var totalBusinesses = await _context.Businesses.CountAsync();
        var activeBusinesses = await _context.Businesses.CountAsync(b => b.IsActive);
        var inactiveBusinesses = totalBusinesses - activeBusinesses;
        var totalUsers = await _context.Users.CountAsync();
        var totalSales = await _context.Sales.CountAsync();
        var totalRevenue = await _context.Sales.SumAsync(s => (decimal?)s.Total ?? 0);

        // Per-business aggregates via BusinessId FK — correct multi-tenant isolation
        var salesAggregates = await _context.Sales
            .GroupBy(s => s.BusinessId)
            .Select(g => new
            {
                BusinessId = g.Key,
                Count = g.Count(),
                Revenue = g.Sum(s => (decimal?)s.Total ?? 0)
            })
            .ToDictionaryAsync(x => x.BusinessId, x => x);

        var businessesRaw = await _context.Businesses
            .OrderBy(b => b.Name)
            .Select(b => new
            {
                b.Id,
                b.Name,
                b.IsActive,
                b.Cuit,
                b.CreatedAt,
                UsersCount = _context.Users.Count(u => u.BusinessId == b.Id)
            })
            .ToListAsync();

        var businesses = businessesRaw.Select(b =>
        {
            salesAggregates.TryGetValue(b.Id, out var agg);
            return new BusinessMetricsDto(
                b.Id,
                b.Name,
                b.IsActive,
                b.Cuit,
                b.UsersCount,
                agg?.Count ?? 0,
                agg?.Revenue ?? 0m,
                b.CreatedAt
            );
        }).ToList();

        var dto = new AdminMetricsDto(
            totalBusinesses,
            activeBusinesses,
            inactiveBusinesses,
            totalUsers,
            totalSales,
            totalRevenue,
            businesses
        );

        return Ok(dto);
    }
}
