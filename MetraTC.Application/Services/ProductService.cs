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

    private async Task<Product> GetProductOrThrowAsync(Guid id)
    {
        var product = await _repository.GetByIdAsync(id);

        if (product == null)
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {id}");

        return product;
    }
}
