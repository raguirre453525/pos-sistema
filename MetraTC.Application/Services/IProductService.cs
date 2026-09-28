using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public interface IProductService
{
    Task<ProductDto> CreateAsync(CreateProductDto createProductDto, Guid businessId);

    Task<IEnumerable<ProductDto>> GetAllAsync(Guid businessId);

    Task<ProductDto> GetByIdAsync(Guid id, Guid businessId);

    Task<StockAdjustmentResponseDto> AdjustStockAsync(Guid id, StockAdjustmentDto stockAdjustmentDto, Guid businessId);

    Task UpdateAsync(Guid id, UpdateProductDto updateProductDto, Guid businessId);

    Task DeleteAsync(Guid id, Guid businessId);

    Task<BulkPriceAdjustmentResultDto> BulkAdjustPricesAsync(BulkPriceAdjustmentDto dto, Guid businessId);
}
