using MetraTC.Domain.Enums;
using System;
using System.Collections.Generic;

namespace MetraTC.Application.DTOs;

public static class OrderDtos
{
    public record OrderItemDto(
        Guid Id,
        Guid ProductId,
        string ProductName,
        decimal UnitPrice,
        int Quantity,
        decimal SubTotal
    );

    public record OrderDto(
        Guid Id,
        string OrderNumber,
        DateTime Date,
        OrderStatus Status,
        decimal TotalAmount,
        IEnumerable<OrderItemDto> Items
    );

    public record CreateOrderItemDto(
        Guid ProductId,
        int Quantity
    );

    public record CreateOrderDto(
        string OrderNumber,
        IEnumerable<CreateOrderItemDto> Items
    );
}