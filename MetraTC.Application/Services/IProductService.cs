using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public interface IProductService
{
    Task<ProductDto> CreateAsync(CreateProductDto productDto);
}