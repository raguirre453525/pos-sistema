using AutoMapper;
using MetraTC.Domain.Common;
using MetraTC.Domain.Entities;
using MetraTC.Domain.Interfaces;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static MetraTC.Application.DTOs.CategoryDtos;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public class CategoryService : ICategoryService
{
    private readonly IRepository<Category> _repository;
    private readonly ApplicationDbContext _db;
    private readonly IMapper _mapper;

    public CategoryService(IRepository<Category> repository, ApplicationDbContext db, IMapper mapper)
    {
        _repository = repository;
        _db = db;
        _mapper = mapper;
    }

    public async Task<IEnumerable<CategoryDto>> GetAllAsync()
    {
        // Query directly via DbContext to ensure ordering and to include product counts.
        // Uses query filter IsActive automatically; ordering by Name.
        var categories = await _db.Categories
            .Include(c => c.Products)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<CategoryDto>>(categories);
    }

    public async Task<CategoryDto> GetByIdAsync(Guid id)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            throw new KeyNotFoundException($"No se encontró ninguna categoría con el ID: {id}");

        return _mapper.Map<CategoryDto>(category);
    }

    public async Task<CategoryDto> CreateAsync(CreateCategoryDto dto)
    {
        var normalizedName = dto.Name.Trim();

        // Case-insensitive uniqueness among active categories (also enforced by filtered unique index).
        var exists = await _db.Categories
            .IgnoreQueryFilters()
            .AnyAsync(c => c.IsActive && c.Name.ToLower() == normalizedName.ToLower());

        if (exists)
            throw new ConflictException("Ya existe una categoría activa con ese nombre");

        var category = new Category(normalizedName, dto.Description);
        await _repository.AddAsync(category);

        return _mapper.Map<CategoryDto>(category);
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, UpdateCategoryDto dto)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id);
        if (category == null)
            throw new KeyNotFoundException($"No se encontró ninguna categoría con el ID: {id}");

        var normalizedName = dto.Name.Trim();

        var duplicate = await _db.Categories
            .IgnoreQueryFilters()
            .AnyAsync(c => c.IsActive && c.Id != id && c.Name.ToLower() == normalizedName.ToLower());

        if (duplicate)
            throw new ConflictException("Ya existe una categoría activa con ese nombre");

        category.Update(normalizedName, dto.Description);
        await _repository.UpdateAsync(category);

        // Reload with products for accurate ProductCount mapping
        var reloaded = await _db.Categories.Include(c => c.Products).FirstAsync(c => c.Id == id);
        return _mapper.Map<CategoryDto>(reloaded);
    }

    public async Task DeleteAsync(Guid id)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            throw new KeyNotFoundException($"No se encontró ninguna categoría con el ID: {id}");

        // Business rule: do not soft-delete if it has active products associated.
        // Decision: reject with 409 Conflict so operator must first unassign or deactivate products.
        // Alternative (desvincular) would hide data silently; explicit rejection is safer.
        var hasActiveProducts = category.Products.Any(p => p.IsActive);
        if (hasActiveProducts)
            throw new ConflictException("No se puede eliminar la categoría porque tiene productos activos asociados");

        category.Deactivate();
        await _repository.UpdateAsync(category);
    }

    public async Task<IEnumerable<ProductDto>> GetProductsAsync(Guid categoryId)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == categoryId);

        if (category == null)
            throw new KeyNotFoundException($"No se encontró ninguna categoría con el ID: {categoryId}");

        var activeProducts = category.Products.Where(p => p.IsActive).ToList();
        return _mapper.Map<IEnumerable<ProductDto>>(activeProducts);
    }

    public async Task AssignProductAsync(Guid categoryId, Guid productId)
    {
        var category = await _db.Categories.Include(c => c.Products).FirstOrDefaultAsync(c => c.Id == categoryId);
        if (category == null)
            throw new KeyNotFoundException($"No se encontró ninguna categoría con el ID: {categoryId}");

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId);
        if (product == null)
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {productId}");

        if (category.Products.Any(p => p.Id == productId))
            return; // idempotent

        category.Products.Add(product);
        await _db.SaveChangesAsync();
    }

    public async Task UnassignProductAsync(Guid categoryId, Guid productId)
    {
        var category = await _db.Categories.Include(c => c.Products).FirstOrDefaultAsync(c => c.Id == categoryId);
        if (category == null)
            throw new KeyNotFoundException($"No se encontró ninguna categoría con el ID: {categoryId}");

        var product = category.Products.FirstOrDefault(p => p.Id == productId);
        if (product == null)
            return; // idempotent

        category.Products.Remove(product);
        await _db.SaveChangesAsync();
    }
}
