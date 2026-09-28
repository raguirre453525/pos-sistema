using MetraTC.Domain.Entities;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static MetraTC.Application.DTOs.PromotionDtos;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public class PromotionService : IPromotionService
{
    private readonly ApplicationDbContext _context;

    public PromotionService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PromotionDto> CreateAsync(CreatePromotionDto dto, Guid businessId)
    {
        var normalizedFrom = NormalizeFrom(dto.ValidFrom);
        var normalizedTo = NormalizeTo(dto.ValidTo);
        var lines = await ResolveLinesAsync(dto.Lines, dto.ProductIds, businessId);
        var promo = new Promotion(dto.Name, dto.Type, dto.Description, dto.IsActive, normalizedFrom, normalizedTo, dto.ComboPrice, dto.DiscountPercentage, lines.Select(l => (l.ProductId, l.Quantity)));
        promo.BusinessId = businessId;
        promo.SetImageUrl(dto.ImageUrl);
        foreach (var line in promo.Lines)
        {
            var prod = lines.First(x => x.ProductId == line.ProductId).Product;
        }
        _context.Promotions.Add(promo);
        await _context.SaveChangesAsync();
        promo = await _context.Promotions.Include(p => p.Lines).ThenInclude(l => l.Product).IgnoreQueryFilters().FirstAsync(p => p.Id == promo.Id);
        return Map(promo);
    }

    public async Task<PromotionDto> UpdateAsync(Guid id, UpdatePromotionDto dto, Guid businessId)
    {
        var promo = await _context.Promotions.Include(p => p.Lines).ThenInclude(l => l.Product).IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id && p.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró promoción con ID: {id}");
        var normalizedFrom = NormalizeFrom(dto.ValidFrom);
        var normalizedTo = NormalizeTo(dto.ValidTo);
        var lines = await ResolveLinesAsync(dto.Lines, dto.ProductIds, businessId);
        var existingIds = promo.Lines.Select(l => l.ProductId).ToHashSet();
        var incomingIds = lines.Select(l => l.ProductId).ToHashSet();
        var toRemove = promo.Lines.Where(l => !incomingIds.Contains(l.ProductId)).ToList();
        foreach (var r in toRemove) _context.PromotionProducts.Remove(r);
        promo.Update(dto.Name, dto.Description, dto.Type, dto.IsActive, normalizedFrom, normalizedTo, dto.ComboPrice, dto.DiscountPercentage, lines.Select(l => (l.ProductId, l.Quantity)));
        if (dto.ImageUrl != null)
        {
            if (!string.IsNullOrWhiteSpace(dto.ImageUrl))
                promo.SetImageUrl(dto.ImageUrl);
        }
        await _context.SaveChangesAsync();
        promo = await _context.Promotions.Include(p => p.Lines).ThenInclude(l => l.Product).IgnoreQueryFilters().FirstAsync(p => p.Id == id);
        return Map(promo);
    }

    public async Task DeleteAsync(Guid id, Guid businessId)
    {
        var promo = await _context.Promotions.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id && p.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró promoción con ID: {id}");
        promo.Deactivate();
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<PromotionDto>> GetAllAsync(Guid businessId)
    {
        var list = await _context.Promotions.Include(p => p.Lines).ThenInclude(l => l.Product).IgnoreQueryFilters().Where(p => p.BusinessId == businessId).ToListAsync();
        return list.Select(Map);
    }

    public async Task<IEnumerable<PromotionDto>> GetActiveAsync(Guid businessId)
    {
        var now = DateTime.UtcNow;
        var list = await _context.Promotions.Include(p => p.Lines).ThenInclude(l => l.Product).Where(p => p.BusinessId == businessId).ToListAsync();
        return list.Where(p => p.IsCurrentlyActive(now)).Select(Map);
    }

    public async Task<PromotionDto> GetByIdAsync(Guid id, Guid businessId)
    {
        var promo = await _context.Promotions.Include(p => p.Lines).ThenInclude(l => l.Product).IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id && p.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró promoción con ID: {id}");
        return Map(promo);
    }

    public async Task<PromotionDto> ToggleActiveAsync(Guid id, Guid businessId)
    {
        var promo = await _context.Promotions.Include(p => p.Lines).ThenInclude(l => l.Product).IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id && p.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró promoción con ID: {id}");
        promo.SetActive(!promo.IsActive);
        await _context.SaveChangesAsync();
        return Map(promo);
    }

    private async Task<List<(Guid ProductId, int Quantity, Product Product)>> ResolveLinesAsync(List<PromotionLineDto>? lines, List<Guid>? legacyIds, Guid businessId)
    {
        List<PromotionLineDto> effective;
        if (lines != null && lines.Count > 0) effective = lines;
        else if (legacyIds != null && legacyIds.Count > 0) effective = legacyIds.Select(id => new PromotionLineDto(id, 1)).ToList();
        else effective = new List<PromotionLineDto>();

        if (effective.Count == 0) return new List<(Guid,int,Product)>();
        foreach (var l in effective)
        {
            if (l.Quantity < 1 || l.Quantity > 99) throw new ArgumentException($"Quantity 1..99 para producto {l.ProductId}");
        }
        var grouped = effective.GroupBy(x => x.ProductId).Select(g => new PromotionLineDto(g.Key, g.Sum(x => x.Quantity))).ToList();
        var ids = grouped.Select(x => x.ProductId).ToList();
        var products = await _context.Products.Where(p => ids.Contains(p.Id) && p.BusinessId == businessId).ToListAsync();
        if (products.Count != ids.Count)
        {
            var found = products.Select(p => p.Id).ToHashSet();
            var missing = ids.Where(x => !found.Contains(x)).ToList();
            throw new KeyNotFoundException($"No se encontraron productos: {string.Join(", ", missing)}");
        }
        var dict = products.ToDictionary(p => p.Id);
        return grouped.Select(g => (g.ProductId, g.Quantity, dict[g.ProductId])).ToList();
    }

    private async Task<ICollection<Product>> LoadProductsAsync(List<Guid> ids)
    {
        if (ids == null || ids.Count == 0) return new List<Product>();
        var distinct = ids.Distinct().ToList();
        var products = await _context.Products.Where(p => distinct.Contains(p.Id)).ToListAsync();
        if (products.Count != distinct.Count)
        {
            var found = products.Select(p => p.Id).ToHashSet();
            var missing = distinct.Where(x => !found.Contains(x)).ToList();
            throw new KeyNotFoundException($"No se encontraron productos: {string.Join(", ", missing)}");
        }
        return products;
    }

    private static PromotionDto Map(Promotion p)
    {
        var lines = p.Lines?.Select(l =>
        {
            var prod = l.Product;
            var name = prod?.Name ?? l.ProductId.ToString();
            var sku = prod?.Sku ?? "";
            var price = prod?.Price ?? 0;
            return new PromotionProductDto(l.ProductId, name, sku, price, l.Quantity, price * l.Quantity);
        }).ToList() ?? new List<PromotionProductDto>();

        var productDtos = lines.Select(l => new ProductDto(l.ProductId, l.Sku, null, l.ProductName, null, l.UnitPrice, 0, null, null, null, false)).ToList();
        var total = lines.Sum(x => x.LineTotal);
        decimal? savingAmount = null;
        decimal? savingPercent = null;
        if (p.Type == PromotionType.Combo && p.ComboPrice.HasValue)
        {
            savingAmount = total - p.ComboPrice.Value;
            savingPercent = total > 0 ? (savingAmount.Value / total * 100) : 0;
        }
        else if (p.Type == PromotionType.Percentage && p.DiscountPercentage.HasValue)
        {
            savingAmount = total * p.DiscountPercentage.Value / 100;
            savingPercent = p.DiscountPercentage.Value;
        }
        return new PromotionDto(p.Id, p.Name, p.Description, p.Type, p.IsActive, p.ValidFrom, p.ValidTo, p.ComboPrice, p.DiscountPercentage, lines, productDtos, total, savingAmount, savingPercent, p.IsCurrentlyActive(DateTime.UtcNow), p.ImageUrl);
    }

    private static DateTime? NormalizeFrom(DateTime? d)
    {
        if (!d.HasValue) return null;
        var dt = d.Value;
        return new DateTime(dt.Year, dt.Month, dt.Day, 0, 0, 0, DateTimeKind.Utc);
    }
    private static DateTime? NormalizeTo(DateTime? d)
    {
        if (!d.HasValue) return null;
        var dt = d.Value;
        return new DateTime(dt.Year, dt.Month, dt.Day, 23, 59, 59, DateTimeKind.Utc);
    }
}
