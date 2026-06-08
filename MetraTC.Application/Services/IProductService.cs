using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public interface IProductService
{
    Task<IEnumerable<ProductDto>> CreateAsync(IEnumerable<CreateProductDto> createProductDtos);

    Task<IEnumerable<ProductDto>> GetAllAsync();

    Task<ProductDto> GetByIdAsync(Guid id);

    Task UpdateAsync(Guid id, UpdateProductDto updateProductDto);

    Task DeleteAsync(Guid id);
}