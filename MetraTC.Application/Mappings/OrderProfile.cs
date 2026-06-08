using AutoMapper;
using MetraTC.Domain.Entities;
using static MetraTC.Application.DTOs.OrderDtos;

namespace MetraTC.Application.Mappings;

public class OrderProfile : Profile
{
    public OrderProfile()
    {
        CreateMap<OrderItem, OrderItemDto>();
        CreateMap<Order, OrderDto>();
    }
}