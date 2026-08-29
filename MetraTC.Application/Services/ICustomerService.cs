using static MetraTC.Application.DTOs.CustomerDtos;

namespace MetraTC.Application.Services;

public interface ICustomerService
{
    Task<CustomerDto> CreateAsync(CreateCustomerDto dto);
    Task<CustomerDto> UpdateAsync(Guid id, UpdateCustomerDto dto);
    Task<IEnumerable<CustomerDto>> GetAllAsync();
    Task<CustomerDto> GetByIdAsync(Guid id);
    Task<CustomerDetailDto> GetDetailAsync(Guid id);
    Task DeleteAsync(Guid id);
    Task<CustomerPaymentDto> RegisterPaymentAsync(Guid customerId, CreatePaymentDto dto);
}
