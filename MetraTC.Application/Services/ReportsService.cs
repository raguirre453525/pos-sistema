using AutoMapper;
using MetraTC.Application.DTOs;
using MetraTC.Domain.Enums;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static MetraTC.Application.DTOs.ReportDtos;
using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Services;

public class ReportsService : IReportsService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public ReportsService(ApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<IEnumerable<LowStockDto>> GetLowStockAsync(int threshold = 5)
    {
        if (threshold < 0 || threshold > 1000)
            throw new ArgumentException("Threshold debe estar entre 0 y 1000", nameof(threshold));

        var products = await _context.Products
            .AsNoTracking()
            .Where(p => p.IsActive && p.Stock <= threshold)
            .OrderBy(p => p.Stock)
            .ThenBy(p => p.Name)
            .ToListAsync();

        return products.Select(p => new LowStockDto
        {
            Id = p.Id,
            Sku = p.Sku,
            Name = p.Name,
            Price = p.Price,
            Stock = p.Stock,
            Threshold = threshold
        }).ToList();
    }

    public async Task<PagedResult<SaleDto>> GetSalesAsync(
        DateTime? from,
        DateTime? to,
        PaymentMethod? paymentMethod,
        int page = 1,
        int pageSize = 20)
    {
        if (page < 1)
            throw new ArgumentException("Page debe ser mayor o igual a 1", nameof(page));
        if (pageSize < 1 || pageSize > 100)
            throw new ArgumentException("PageSize debe estar entre 1 y 100", nameof(pageSize));
        if (paymentMethod.HasValue && !Enum.IsDefined(typeof(PaymentMethod), paymentMethod.Value))
            throw new ArgumentException("Método de pago inválido", nameof(paymentMethod));

        var normalizedFrom = NormalizeFrom(from);
        var normalizedTo = NormalizeTo(to);

        if (normalizedFrom.HasValue && normalizedTo.HasValue && normalizedFrom.Value > normalizedTo.Value)
            throw new ArgumentException("from no puede ser mayor que to");

        var query = _context.Sales
            .IgnoreQueryFilters()
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .AsNoTracking()
            .AsQueryable();

        if (normalizedFrom.HasValue)
            query = query.Where(s => s.Date >= normalizedFrom.Value);
        if (normalizedTo.HasValue)
            query = query.Where(s => s.Date <= normalizedTo.Value);
        if (paymentMethod.HasValue)
            query = query.Where(s => s.PaymentMethod == paymentMethod.Value);

        query = query
            .OrderByDescending(s => s.Date)
            .ThenByDescending(s => s.Id);

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = _mapper.Map<List<SaleDto>>(items);

        return new PagedResult<SaleDto>
        {
            Items = dtos,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PagedResult<StockAuditDto>> GetStockAuditsAsync(
        Guid? productId,
        DateTime? from,
        DateTime? to,
        int page = 1,
        int pageSize = 20,
        string? reasonContains = null)
    {
        if (page < 1)
            throw new ArgumentException("Page debe ser mayor o igual a 1", nameof(page));
        if (pageSize < 1 || pageSize > 100)
            throw new ArgumentException("PageSize debe estar entre 1 y 100", nameof(pageSize));

        var normalizedFrom = NormalizeFrom(from);
        var normalizedTo = NormalizeTo(to);

        if (normalizedFrom.HasValue && normalizedTo.HasValue && normalizedFrom.Value > normalizedTo.Value)
            throw new ArgumentException("from no puede ser mayor que to");

        if (productId.HasValue)
        {
            var exists = await _context.Products
                .IgnoreQueryFilters()
                .AsNoTracking()
                .AnyAsync(p => p.Id == productId.Value);
            if (!exists)
                throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {productId.Value}");
        }

        var query = _context.StockAdjustmentAudits
            .IgnoreQueryFilters()
            .Include(a => a.Product)
            .AsNoTracking()
            .AsQueryable();

        if (productId.HasValue)
            query = query.Where(a => a.ProductId == productId.Value);
        if (normalizedFrom.HasValue)
            query = query.Where(a => a.AdjustedAt >= normalizedFrom.Value);
        if (normalizedTo.HasValue)
            query = query.Where(a => a.AdjustedAt <= normalizedTo.Value);
        if (!string.IsNullOrWhiteSpace(reasonContains))
            query = query.Where(a => a.Reason.Contains(reasonContains));

        query = query.OrderByDescending(a => a.AdjustedAt);

        var totalCount = await query.CountAsync();

        var audits = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = audits.Select(a => new StockAuditDto
        {
            Id = a.Id,
            ProductId = a.ProductId,
            Sku = a.Product != null ? a.Product.Sku : string.Empty,
            ProductName = a.Product != null ? a.Product.Name : string.Empty,
            Delta = a.Delta,
            ResultingStock = a.ResultingStock,
            Reason = a.Reason,
            AdjustedAt = a.AdjustedAt
        }).ToList();

        return new PagedResult<StockAuditDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    private static DateTime? NormalizeFrom(DateTime? from)
    {
        if (!from.HasValue) return null;
        var dt = from.Value;
        if (dt.Kind == DateTimeKind.Local)
            dt = dt.ToUniversalTime();
        else if (dt.Kind == DateTimeKind.Unspecified)
            dt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        // 00:00:00 UTC del día
        return DateTime.SpecifyKind(dt.Date, DateTimeKind.Utc);
    }

    private static DateTime? NormalizeTo(DateTime? to)
    {
        if (!to.HasValue) return null;
        var dt = to.Value;
        if (dt.Kind == DateTimeKind.Local)
            dt = dt.ToUniversalTime();
        else if (dt.Kind == DateTimeKind.Unspecified)
            dt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        // 23:59:59.999 UTC del día (inclusive)
        return DateTime.SpecifyKind(dt.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
    }
}
