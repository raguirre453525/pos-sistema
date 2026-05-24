using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public interface IProductService
{
    Task<ProductDto> CreateAsync(CreateProductDto createProductDto);

    Task<IEnumerable<ProductDto>> GetAllAsync();

    Task<ProductDto> GetByIdAsync(Guid id);

    Task UpdateAsync(Guid id, UpdateProductDto updateProductDto);

    Task DeleteAsync(Guid id);
}