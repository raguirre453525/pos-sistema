using MetraTC.Application.DTOs;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public interface IProductPriceHistoryService
{
    Task<PagedResult<ProductPriceHistoryDto>> GetPriceHistoryAsync(Guid productId, DateTime? from, DateTime? to, int page, int pageSize);
}
