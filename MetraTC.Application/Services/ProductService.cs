using AutoMapper;
using MetraTC.Domain.Entities;
using MetraTC.Domain.Interfaces; // Asumiendo que tienes IRepository<T> igual que el sistema médico
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public class ProductService : IProductService
{
    private readonly IRepository<Product> _repository;
    private readonly IInventoryRepository _inventoryRepository;
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public ProductService(IRepository<Product> repository, IInventoryRepository inventoryRepository, ApplicationDbContext context, IMapper mapper)
    {
        _repository = repository;
        _inventoryRepository = inventoryRepository;
        _context = context;
        _mapper = mapper;
    }

    public async Task<ProductDto> CreateAsync(CreateProductDto createProductDto, Guid businessId)
    {
        var product = _mapper.Map<Product>(createProductDto);
        product.BusinessId = businessId;
        await _repository.AddAsync(product);

        return _mapper.Map<ProductDto>(product);
    }

    public async Task<IEnumerable<ProductDto>> GetAllAsync(Guid businessId)
    {
        var products = await _context.Products.Where(p => p.BusinessId == businessId).ToListAsync();
        return _mapper.Map<IEnumerable<ProductDto>>(products);
    }

    public async Task<ProductDto> GetByIdAsync(Guid id, Guid businessId)
    {
        var product = await GetProductOrThrowAsync(id, businessId);

        return _mapper.Map<ProductDto>(product);
    }

    public async Task UpdateAsync(Guid id, UpdateProductDto updateProductDto, Guid businessId)
    {
        var product = await GetProductOrThrowAsync(id, businessId);

        var oldPrice = product.Price;

        product.Update(updateProductDto.Name, updateProductDto.Price, updateProductDto.Description);
        // Only change ImageUrl/Unit/MinStock if explicitly provided with non-empty value; preserve existing if null/whitespace (spec: no sobrescribir con default si viene vacía al editar)
        if (updateProductDto.ImageUrl != null)
        {
            if (!string.IsNullOrWhiteSpace(updateProductDto.ImageUrl))
                // FIX: ImageUrl admite ruta relativa /images/... o URL absoluta externa (http...), se valida longitud en entidad; no filtrar externa
                product.SetImageUrl(updateProductDto.ImageUrl);
            // else preserve existing — do nothing
        }
        if (updateProductDto.Unit != null)
        {
            if (!string.IsNullOrWhiteSpace(updateProductDto.Unit))
            {
                // FIX: Unit inválido no debe tirar excepción no controlada 500 ni crash front; FluentValidation ya valida, aquí defendemos y mapeamos a 400
                try { product.SetUnit(updateProductDto.Unit); }
                catch (ArgumentException) { throw; } // ExceptionMiddleware -> 400 BadRequest {message}
            }
            // else preserve
        }
        if (updateProductDto.MinStock.HasValue)
        {
            // FIX: redondeo a 3 decimales evita overflow decimal(18,3) con valores legacy con más decimales / NaN
            var roundedMin = Math.Round(updateProductDto.MinStock.Value, 3, MidpointRounding.AwayFromZero);
            // defensa extra: NaN no aplica a decimal pero legacy int->decimal puede traer valores extremos
            if (roundedMin < 0) roundedMin = 0;
            if (roundedMin > 99999) roundedMin = 99999;
            product.SetMinStock(roundedMin);
        }

        if (oldPrice != updateProductDto.Price)
        {
            // Transacción atómica: update producto + historial
            await using var transaction = _context.Database.CurrentTransaction is null
                ? await _context.Database.BeginTransactionAsync()
                : null;
            _context.Products.Update(product);
            var history = new ProductPriceHistory(product.Id, oldPrice, updateProductDto.Price, null);
            _context.ProductPriceHistories.Add(history);
            await _context.SaveChangesAsync();
            if (transaction is not null) await transaction.CommitAsync();
            return;
        }

        await _repository.UpdateAsync(product);
    }

    public async Task<StockAdjustmentResponseDto> AdjustStockAsync(Guid id, StockAdjustmentDto stockAdjustmentDto, Guid businessId)
    {
        // Ownership check before delegating to inventory repo
        var exists = await _context.Products.AnyAsync(p => p.Id == id && p.BusinessId == businessId);
        if (!exists) throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {id}");
        var result = await _inventoryRepository.AdjustStockAsync(id, stockAdjustmentDto.Delta, stockAdjustmentDto.Reason);

        return new StockAdjustmentResponseDto(
            _mapper.Map<ProductDto>(result.Product),
            result.Audit.Delta,
            result.Audit.ResultingStock,
            result.Audit.Reason,
            result.Audit.AdjustedAt);
    }

    public async Task DeleteAsync(Guid id, Guid businessId)
    {
        var product = await GetProductOrThrowAsync(id, businessId);

        product.Deactivate();

        await _repository.UpdateAsync(product);
    }

    public async Task<BulkPriceAdjustmentResultDto> BulkAdjustPricesAsync(BulkPriceAdjustmentDto dto, Guid businessId)
    {
        // Validations
        if (string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Trim().Length < 3 || dto.Reason.Trim().Length > 500)
            throw new ArgumentException("Motivo requerido (3..500 caracteres)", nameof(dto.Reason));

        var trimmedReason = dto.Reason.Trim();
        var hasPercentage = dto.Percentage.HasValue && dto.Percentage.Value != 0;
        var hasFixed = dto.FixedAmount.HasValue && dto.FixedAmount.Value != 0;
        if (!hasPercentage && !hasFixed)
            throw new ArgumentException("Al menos uno de Percentage o FixedAmount debe ser distinto de 0");

        if (dto.Percentage.HasValue && (dto.Percentage.Value < -90 || dto.Percentage.Value > 500))
            throw new ArgumentException("Percentage debe estar entre -90 y 500", nameof(dto.Percentage));

        if (dto.FixedAmount.HasValue && (dto.FixedAmount.Value < -1_000_000 || dto.FixedAmount.Value > 1_000_000))
            throw new ArgumentException("FixedAmount debe estar entre -1000000 y 1000000", nameof(dto.FixedAmount));

        List<Product> products;

        if (dto.ProductIds != null && dto.ProductIds.Any())
        {
            var distinctIds = dto.ProductIds.Distinct().ToList();
            products = await _context.Products
                .Where(p => distinctIds.Contains(p.Id) && p.BusinessId == businessId)
                .ToListAsync();

            // Validate all exist, belong to business and are active (query filter hides inactive)
            if (products.Count != distinctIds.Count)
            {
                var foundIds = products.Select(p => p.Id).ToHashSet();
                var missing = distinctIds.Where(id => !foundIds.Contains(id)).ToList();
                throw new KeyNotFoundException($"No se encontraron productos con IDs: {string.Join(", ", missing)}");
            }
        }
        else if (dto.CategoryId.HasValue)
        {
            var catId = dto.CategoryId.Value;
            var categoryExists = await _context.Categories.AnyAsync(c => c.Id == catId);
            if (!categoryExists)
                throw new KeyNotFoundException($"No se encontró ninguna categoría con el ID: {catId}");

            products = await _context.Products
                .Include(p => p.Categories)
                .Where(p => p.BusinessId == businessId && p.Categories.Any(c => c.Id == catId))
                .ToListAsync();
        }
        else
        {
            products = await _context.Products.Where(p => p.BusinessId == businessId).ToListAsync();
        }

        if (products.Count == 0)
            throw new InvalidOperationException("No hay productos para el criterio");

        var histories = new List<ProductPriceHistory>();
        var now = DateTime.UtcNow;

        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var product in products)
        {
            var oldPrice = product.Price;
            var newPrice = Math.Round(oldPrice * (1m + (dto.Percentage ?? 0) / 100m) + (dto.FixedAmount ?? 0), 2, MidpointRounding.AwayFromZero);
            if (newPrice < 0) newPrice = 0;
            // Redondeo comercial a $10 o $50 más cercano (evita precios engorrosos en mostrador)
            if (dto.Rounding.HasValue && dto.Rounding.Value > 0)
            {
                var step = (decimal)dto.Rounding.Value;
                newPrice = Math.Round(newPrice / step, 0, MidpointRounding.AwayFromZero) * step;
                newPrice = Math.Round(newPrice, 2, MidpointRounding.AwayFromZero);
            }
            if (newPrice == oldPrice) continue;

            product.Update(product.Name, newPrice, product.Description);
            // Product is tracked, no need to call Update explicitly but ensure state
            var history = new ProductPriceHistory(product.Id, oldPrice, newPrice, trimmedReason);
            _context.ProductPriceHistories.Add(history);
            histories.Add(history);
        }

        if (histories.Count == 0)
        {
            await transaction.RollbackAsync();
            return new BulkPriceAdjustmentResultDto(0, new List<ProductPriceHistoryDto>());
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        var dtos = histories.Select(h => new ProductPriceHistoryDto(
            h.Id,
            h.ProductId,
            h.OldPrice,
            h.NewPrice,
            h.ChangedAt,
            h.Reason,
            h.OldPrice == 0 ? 0 : (h.NewPrice - h.OldPrice) / h.OldPrice * 100
        )).ToList();

        return new BulkPriceAdjustmentResultDto(dtos.Count, dtos);
    }

    private async Task<Product> GetProductOrThrowAsync(Guid id, Guid businessId)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id && p.BusinessId == businessId);
        // fallback to repository for global query filter consistency (IsActive)
        if (product == null)
        {
            // Check via repository to distinguish not found vs wrong business (both map to 404 to prevent enumeration)
            var any = await _repository.GetByIdAsync(id);
            // Still return not found for cross-tenant to avoid leaking existence
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {id}");
        }

        return product;
    }
}
