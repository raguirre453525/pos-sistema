using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using static MetraTC.Application.DTOs.OrderDtos;

namespace MetraTC.Application.Services;

public interface IOrderService
{
    Task<OrderDto> CreateAsync(CreateOrderDto createOrderDto);
    Task<IEnumerable<OrderDto>> GetAllAsync();
    Task<OrderDto?> GetByIdAsync(Guid id);
    Task CompleteAsync(Guid id);
    Task CancelAsync(Guid id);
}