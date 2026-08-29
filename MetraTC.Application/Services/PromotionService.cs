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

    public async Task<PromotionDto> CreateAsync(CreatePromotionDto dto)
    {
        var normalizedFrom = NormalizeFrom(dto.ValidFrom);
        var normalizedTo = NormalizeTo(dto.ValidTo);
        var products = await LoadProductsAsync(dto.ProductIds);
        var promo = new Promotion(dto.Name, dto.Type, dto.Description, dto.IsActive, normalizedFrom, normalizedTo, dto.ComboPrice, dto.DiscountPercentage, products);
        _context.Promotions.Add(promo);
        await _context.SaveChangesAsync();
        return Map(promo);
    }

    public async Task<PromotionDto> UpdateAsync(Guid id, UpdatePromotionDto dto)
    {
        var promo = await _context.Promotions.Include(p => p.Products).IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException($"No se encontró promoción con ID: {id}");
        var normalizedFrom = NormalizeFrom(dto.ValidFrom);
        var normalizedTo = NormalizeTo(dto.ValidTo);
        var products = await LoadProductsAsync(dto.ProductIds);
        promo.Update(dto.Name, dto.Description, dto.Type, dto.IsActive, normalizedFrom, normalizedTo, dto.ComboPrice, dto.DiscountPercentage, products);
        await _context.SaveChangesAsync();
        return Map(promo);
    }

    public async Task DeleteAsync(Guid id)
    {
        var promo = await _context.Promotions.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException($"No se encontró promoción con ID: {id}");
        promo.Deactivate();
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<PromotionDto>> GetAllAsync()
    {
        var list = await _context.Promotions.Include(p => p.Products).IgnoreQueryFilters().ToListAsync();
        return list.Select(Map);
    }

    public async Task<IEnumerable<PromotionDto>> GetActiveAsync()
    {
        var now = DateTime.UtcNow;
        var list = await _context.Promotions.Include(p => p.Products).ToListAsync(); // query filter already IsActive
        return list.Where(p => p.IsCurrentlyActive(now)).Select(Map);
    }

    public async Task<PromotionDto> GetByIdAsync(Guid id)
    {
        var promo = await _context.Promotions.Include(p => p.Products).IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException($"No se encontró promoción con ID: {id}");
        return Map(promo);
    }

    public async Task<PromotionDto> ToggleActiveAsync(Guid id)
    {
        var promo = await _context.Promotions.Include(p => p.Products).IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException($"No se encontró promoción con ID: {id}");
        promo.SetActive(!promo.IsActive);
        await _context.SaveChangesAsync();
        return Map(promo);
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
        var productDtos = p.Products.Select(pr => new ProductDto(pr.Id, pr.Sku, pr.Barcode, pr.Name, pr.Description, pr.Price, pr.Stock)).ToList();
        var total = productDtos.Sum(x => x.Price);
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
        return new PromotionDto(p.Id, p.Name, p.Description, p.Type, p.IsActive, p.ValidFrom, p.ValidTo, p.ComboPrice, p.DiscountPercentage, productDtos, total, savingAmount, savingPercent, p.IsCurrentlyActive(DateTime.UtcNow));
    }

    private static DateTime? NormalizeFrom(DateTime? d)
    {
        if (!d.HasValue) return null;
        var dt = d.Value;
        // treat as date only, set to 00:00 UTC
        return new DateTime(dt.Year, dt.Month, dt.Day, 0, 0, 0, DateTimeKind.Utc);
    }
    private static DateTime? NormalizeTo(DateTime? d)
    {
        if (!d.HasValue) return null;
        var dt = d.Value;
        return new DateTime(dt.Year, dt.Month, dt.Day, 23, 59, 59, DateTimeKind.Utc);
    }
}
