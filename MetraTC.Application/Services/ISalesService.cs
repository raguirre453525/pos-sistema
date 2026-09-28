using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Services;

public interface ISalesService
{
    Task<SaleDto> CreateAsync(CreateSaleDto dto, Guid businessId);
    Task<SaleDto> GetByIdAsync(Guid id, Guid businessId);
    Task<IEnumerable<SaleDto>> GetAllAsync(Guid businessId);
}
