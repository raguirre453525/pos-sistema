using static MetraTC.Application.DTOs.CategoryDtos;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public interface ICategoryService
{
    Task<IEnumerable<CategoryDto>> GetAllAsync();
    Task<CategoryDto> GetByIdAsync(Guid id);
    Task<CategoryDto> CreateAsync(CreateCategoryDto dto);
    Task<CategoryDto> UpdateAsync(Guid id, UpdateCategoryDto dto);
    Task DeleteAsync(Guid id);

    // Optional but valuable
    Task<IEnumerable<ProductDto>> GetProductsAsync(Guid categoryId);
    Task AssignProductAsync(Guid categoryId, Guid productId);
    Task UnassignProductAsync(Guid categoryId, Guid productId);
}
