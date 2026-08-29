using MetraTC.Application.DTOs;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public class ProductPriceHistoryService : IProductPriceHistoryService
{
    private readonly ApplicationDbContext _context;

    public ProductPriceHistoryService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<ProductPriceHistoryDto>> GetPriceHistoryAsync(Guid productId, DateTime? from, DateTime? to, int page, int pageSize)
    {
        if (page < 1)
            throw new ArgumentException("Page debe ser mayor o igual a 1", nameof(page));
        if (pageSize < 1 || pageSize > 100)
            throw new ArgumentException("PageSize debe estar entre 1 y 100", nameof(pageSize));

        var exists = await _context.Products.IgnoreQueryFilters().AsNoTracking().AnyAsync(p => p.Id == productId);
        if (!exists)
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {productId}");

        var normalizedFrom = NormalizeFrom(from);
        var normalizedTo = NormalizeTo(to);
        if (normalizedFrom.HasValue && normalizedTo.HasValue && normalizedFrom.Value > normalizedTo.Value)
            throw new ArgumentException("from no puede ser mayor que to");

        var query = _context.ProductPriceHistories.AsNoTracking().AsQueryable().Where(h => h.ProductId == productId);

        if (normalizedFrom.HasValue)
            query = query.Where(h => h.ChangedAt >= normalizedFrom.Value);
        if (normalizedTo.HasValue)
            query = query.Where(h => h.ChangedAt <= normalizedTo.Value);

        query = query.OrderByDescending(h => h.ChangedAt).ThenByDescending(h => h.Id);

        var totalCount = await query.CountAsync();

        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var dtos = items.Select(h => new ProductPriceHistoryDto(
            h.Id,
            h.ProductId,
            h.OldPrice,
            h.NewPrice,
            h.ChangedAt,
            h.Reason,
            h.OldPrice == 0 ? 0 : (h.NewPrice - h.OldPrice) / h.OldPrice * 100
        )).ToList();

        return new PagedResult<ProductPriceHistoryDto>
        {
            Items = dtos,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    private static DateTime? NormalizeFrom(DateTime? from)
    {
        if (!from.HasValue) return null;
        var dt = from.Value;
        if (dt.Kind == DateTimeKind.Local) dt = dt.ToUniversalTime();
        else if (dt.Kind == DateTimeKind.Unspecified) dt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        return DateTime.SpecifyKind(dt.Date, DateTimeKind.Utc);
    }

    private static DateTime? NormalizeTo(DateTime? to)
    {
        if (!to.HasValue) return null;
        var dt = to.Value;
        if (dt.Kind == DateTimeKind.Local) dt = dt.ToUniversalTime();
        else if (dt.Kind == DateTimeKind.Unspecified) dt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        return DateTime.SpecifyKind(dt.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
    }
}
