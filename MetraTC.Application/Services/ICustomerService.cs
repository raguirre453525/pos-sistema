using static MetraTC.Application.DTOs.CustomerDtos;

namespace MetraTC.Application.Services;

public interface ICustomerService
{
    Task<CustomerDto> CreateAsync(CreateCustomerDto dto, Guid businessId);
    Task<CustomerDto> UpdateAsync(Guid id, UpdateCustomerDto dto, Guid businessId);
    Task<IEnumerable<CustomerDto>> GetAllAsync(Guid businessId);
    Task<CustomerDto> GetByIdAsync(Guid id, Guid businessId);
    Task<CustomerDetailDto> GetDetailAsync(Guid id, Guid businessId);
    Task DeleteAsync(Guid id, Guid businessId);
    Task<CustomerPaymentDto> RegisterPaymentAsync(Guid customerId, CreatePaymentDto dto, Guid businessId);
}
