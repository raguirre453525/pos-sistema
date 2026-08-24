using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Services;

public interface ISalesService
{
    Task<SaleDto> CreateAsync(CreateSaleDto dto);
    Task<SaleDto> GetByIdAsync(Guid id);
    Task<IEnumerable<SaleDto>> GetAllAsync();
}
