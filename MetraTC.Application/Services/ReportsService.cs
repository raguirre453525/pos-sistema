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

    public async Task<IEnumerable<LowStockDto>> GetLowStockAsync(int threshold = 5, Guid? businessId = null)
    {
        if (threshold < 0 || threshold > 1000)
            throw new ArgumentException("Threshold debe estar entre 0 y 1000", nameof(threshold));

        var productsQuery = _context.Products.AsNoTracking().Where(p => p.IsActive);
        if (businessId.HasValue)
            productsQuery = productsQuery.Where(p => p.BusinessId == businessId.Value);
        var products = await productsQuery.ToListAsync();

        var low = products.Where(p => p.IsLowStock() || p.Stock <= threshold)
            .OrderBy(p => p.Stock)
            .ThenBy(p => p.Name)
            .ToList();

        // If caller passes explicit threshold !=5, also include those <=threshold (legacy). Default 5 matches IsLowStock fallback.
        low = products.Where(p => p.MinStock.HasValue ? p.Stock <= p.MinStock.Value : p.Stock <= threshold)
            .OrderBy(p => p.Stock)
            .ThenBy(p => p.Name)
            .ToList();

        return low.Select(p => new LowStockDto
        {
            Id = p.Id,
            Sku = p.Sku,
            Name = p.Name,
            Price = p.Price,
            Stock = p.Stock,
            Threshold = p.MinStock ?? threshold
        }).ToList();
    }

    public async Task<PagedResult<SaleDto>> GetSalesAsync(
        DateTime? from,
        DateTime? to,
        PaymentMethod? paymentMethod,
        int page = 1,
        int pageSize = 20,
        Guid? businessId = null)
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

        if (businessId.HasValue)
            query = query.Where(s => s.BusinessId == businessId.Value);

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
        string? reasonContains = null,
        Guid? businessId = null)
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
            var productQuery = _context.Products.IgnoreQueryFilters().AsNoTracking().Where(p => p.Id == productId.Value);
            if (businessId.HasValue) productQuery = productQuery.Where(p => p.BusinessId == businessId.Value);
            var exists = await productQuery.AnyAsync();
            if (!exists)
                throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {productId.Value}");
        }

        var query = _context.StockAdjustmentAudits
            .IgnoreQueryFilters()
            .Include(a => a.Product)
            .AsNoTracking()
            .AsQueryable();

        if (businessId.HasValue)
            query = query.Where(a => a.Product.BusinessId == businessId.Value);

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

    public async Task<DashboardSummaryDto> GetDashboardAsync(DateTime? from, DateTime? to, Guid? businessId = null)
    {
        var normalizedFrom = NormalizeFrom(from);
        var normalizedTo = NormalizeTo(to);

        if (normalizedFrom.HasValue && normalizedTo.HasValue && normalizedFrom.Value > normalizedTo.Value)
            throw new ArgumentException("from no puede ser mayor que to");

        var query = _context.Sales
            .IgnoreQueryFilters()
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Categories)
            .AsNoTracking()
            .AsQueryable();

        if (businessId.HasValue)
            query = query.Where(s => s.BusinessId == businessId.Value);

        if (normalizedFrom.HasValue)
            query = query.Where(s => s.Date >= normalizedFrom.Value);
        if (normalizedTo.HasValue)
            query = query.Where(s => s.Date <= normalizedTo.Value);

        var sales = await query.ToListAsync();

        var salesCount = sales.Count;
        var totalRevenue = sales.Sum(s => s.Total);
        var productsSoldQuantity = sales.SelectMany(s => s.Items).Sum(i => i.Quantity);
        var ticketAverage = salesCount > 0 ? totalRevenue / salesCount : 0;

        var productsQuery = _context.Products.AsNoTracking().Where(p => p.IsActive);
        if (businessId.HasValue) productsQuery = productsQuery.Where(p => p.BusinessId == businessId.Value);
        var allProducts = await productsQuery.ToListAsync();
        var lowStockCount = allProducts.Count(p => p.IsLowStock());

        DateTime startDate;
        DateTime endDate;
        if (normalizedFrom.HasValue)
            startDate = normalizedFrom.Value.Date;
        else if (normalizedTo.HasValue)
            startDate = normalizedTo.Value.Date.AddDays(-6);
        else
            startDate = DateTime.UtcNow.Date.AddDays(-6);

        if (normalizedTo.HasValue)
            endDate = normalizedTo.Value.Date;
        else if (normalizedFrom.HasValue)
            endDate = normalizedFrom.Value.Date.AddDays(6);
        else
            endDate = DateTime.UtcNow.Date;

        if (startDate > endDate)
        {
            var tmp = startDate;
            startDate = endDate;
            endDate = tmp;
        }

        var totalDays = (endDate - startDate).Days + 1;
        if (totalDays > 366) totalDays = 366;

        var dailySales = new List<DailySaleDto>();
        var groupedByDay = sales.GroupBy(s => s.Date.Date).ToDictionary(g => g.Key, g => g.ToList());
        for (int i = 0; i < totalDays; i++)
        {
            var day = startDate.AddDays(i);
            var dayKey = day.Date;
            if (groupedByDay.TryGetValue(dayKey, out var daySales))
            {
                dailySales.Add(new DailySaleDto
                {
                    Date = DateTime.SpecifyKind(dayKey, DateTimeKind.Utc),
                    Total = daySales.Sum(s => s.Total),
                    Count = daySales.Count
                });
            }
            else
            {
                dailySales.Add(new DailySaleDto
                {
                    Date = DateTime.SpecifyKind(dayKey, DateTimeKind.Utc),
                    Total = 0,
                    Count = 0
                });
            }
        }

        var categoryAgg = new Dictionary<string, (decimal Total, decimal Quantity)>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in sales.SelectMany(s => s.Items))
        {
            var catNames = item.Product?.Categories?.Select(c => c.Name).Where(n => !string.IsNullOrWhiteSpace(n)).ToList();
            List<string> cats;
            if (catNames == null || catNames.Count == 0)
                cats = new List<string> { "Sin categoría" };
            else
                cats = catNames!;

            foreach (var cat in cats)
            {
                if (!categoryAgg.TryGetValue(cat, out var agg))
                    agg = (0, 0);
                agg.Total += item.Subtotal;
                agg.Quantity += item.Quantity;
                categoryAgg[cat] = agg;
            }
        }
        var salesByCategory = categoryAgg
            .Select(kv => new CategorySaleDto { Category = kv.Key, Total = kv.Value.Total, Quantity = kv.Value.Quantity })
            .OrderByDescending(c => c.Total)
            .ToList();

        var topProducts = sales.SelectMany(s => s.Items)
            .GroupBy(i => i.ProductId)
            .Select(g =>
            {
                var first = g.First();
                return new TopProductDto
                {
                    ProductId = g.Key,
                    Sku = first.Product?.Sku ?? string.Empty,
                    Name = first.Product?.Name ?? "Producto",
                    Quantity = g.Sum(x => x.Quantity),
                    Revenue = g.Sum(x => x.Subtotal)
                };
            })
            .OrderByDescending(p => p.Quantity)
            .Take(5)
            .ToList();

        var recent = sales.OrderByDescending(s => s.Date).ThenByDescending(s => s.Id).Take(5).ToList();
        var recentDtos = _mapper.Map<List<SaleDto>>(recent);

        return new DashboardSummaryDto
        {
            SalesCount = salesCount,
            TotalRevenue = totalRevenue,
            ProductsSoldQuantity = productsSoldQuantity,
            TicketAverage = ticketAverage,
            LowStockCount = lowStockCount,
            DailySales = dailySales,
            SalesByCategory = salesByCategory,
            TopProducts = topProducts,
            RecentSales = recentDtos
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
        return DateTime.SpecifyKind(dt.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
    }
}
