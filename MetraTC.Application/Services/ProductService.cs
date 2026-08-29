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

    public async Task<ProductDto> CreateAsync(CreateProductDto createProductDto)
    {
        var product = _mapper.Map<Product>(createProductDto);
        await _repository.AddAsync(product);

        return _mapper.Map<ProductDto>(product);
    }

    public async Task<IEnumerable<ProductDto>> GetAllAsync()
    {
        var products = await _repository.GetAllAsync();

        return _mapper.Map<IEnumerable<ProductDto>>(products);
    }

    public async Task<ProductDto> GetByIdAsync(Guid id)
    {
        var product = await GetProductOrThrowAsync(id);

        return _mapper.Map<ProductDto>(product);
    }

    public async Task UpdateAsync(Guid id, UpdateProductDto updateProductDto)
    {
        var product = await GetProductOrThrowAsync(id);

        var oldPrice = product.Price;

        product.Update(updateProductDto.Name, updateProductDto.Price, updateProductDto.Description);

        if (oldPrice != updateProductDto.Price)
        {
            // Transacción atómica: update producto + historial
            await using var transaction = await _context.Database.BeginTransactionAsync();
            _context.Products.Update(product);
            var history = new ProductPriceHistory(product.Id, oldPrice, updateProductDto.Price, null);
            _context.ProductPriceHistories.Add(history);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return;
        }

        await _repository.UpdateAsync(product);
    }

    public async Task<StockAdjustmentResponseDto> AdjustStockAsync(Guid id, StockAdjustmentDto stockAdjustmentDto)
    {
        var result = await _inventoryRepository.AdjustStockAsync(id, stockAdjustmentDto.Delta, stockAdjustmentDto.Reason);

        return new StockAdjustmentResponseDto(
            _mapper.Map<ProductDto>(result.Product),
            result.Audit.Delta,
            result.Audit.ResultingStock,
            result.Audit.Reason,
            result.Audit.AdjustedAt);
    }

    public async Task DeleteAsync(Guid id)
    {
        var product = await GetProductOrThrowAsync(id);

        product.Deactivate();

        await _repository.UpdateAsync(product);
    }

    public async Task<BulkPriceAdjustmentResultDto> BulkAdjustPricesAsync(BulkPriceAdjustmentDto dto)
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
                .Where(p => distinctIds.Contains(p.Id))
                .ToListAsync();

            // Validate all exist and are active (query filter hides inactive)
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
                .Where(p => p.Categories.Any(c => c.Id == catId))
                .ToListAsync();
        }
        else
        {
            products = await _context.Products.ToListAsync();
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

    private async Task<Product> GetProductOrThrowAsync(Guid id)
    {
        var product = await _repository.GetByIdAsync(id);

        if (product == null)
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {id}");

        return product;
    }
}
