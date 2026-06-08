using MetraTC.Application.DTOs;
using MetraTC.Domain.Entities;
using MetraTC.Domain.Interfaces;
using AutoMapper;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using static MetraTC.Application.DTOs.OrderDtos;

namespace MetraTC.Application.Services;

public class OrderService : IOrderService
{
    private readonly IRepository<Order> _orderRepository;
    private readonly IRepository<Product> _productRepository;
    private readonly IMapper _mapper;

    public OrderService(
        IRepository<Order> orderRepository,
        IRepository<Product> productRepository,
        IMapper mapper)
    {
        _orderRepository = orderRepository;
        _productRepository = productRepository;
        _mapper = mapper;
    }

    public async Task<OrderDto> CreateAsync(CreateOrderDto createOrderDto)
    {
        var order = new Order(createOrderDto.OrderNumber);

        foreach (var itemDto in createOrderDto.Items)
        {
            var product = await _productRepository.GetByIdAsync(itemDto.ProductId);

            if (product == null)
                throw new KeyNotFoundException($"No se encontró el producto con ID: {itemDto.ProductId}");

            if (product.Stock < itemDto.Quantity)
                throw new InvalidOperationException($"Stock insuficiente para '{product.Name}'. Stock disponible: {product.Stock}, Solicitado: {itemDto.Quantity}");

            order.AddItem(
                product.Id,
                product.Name,
                product.Price,
                itemDto.Quantity
            );
        }

        await _orderRepository.AddAsync(order);

        return _mapper.Map<OrderDto>(order);
    }

    public async Task<IEnumerable<OrderDto>> GetAllAsync()
    {
        var orders = await _orderRepository.GetAllAsync();
        return _mapper.Map<IEnumerable<OrderDto>>(orders);
    }

    public async Task<OrderDto> GetByIdAsync(Guid id)
    {
        var order = await GetOrderOrThrowAsync(id);

        return _mapper.Map<OrderDto>(order);
    }

    public async Task CompleteAsync(Guid id)
    {
        var order = await GetOrderOrThrowAsync(id);

        foreach (var item in order.Items)
        {
            var product = await _productRepository.GetByIdAsync(item.ProductId);

            if (product != null)
            {
                product.ReduceStock(item.Quantity);

                await _productRepository.UpdateAsync(product);
            }
        }

        order.Complete();

        await _orderRepository.UpdateAsync(order);
    }

    public async Task CancelAsync(Guid id)
    {
        var order = await GetOrderOrThrowAsync(id);

        order.Cancel();
        await _orderRepository.UpdateAsync(order);
    }

    private async Task<Order> GetOrderOrThrowAsync(Guid id)
    {
        var order = await _orderRepository.GetByIdAsync(id, "Items");

        if (order == null)
            throw new KeyNotFoundException($"No se encontró la orden con el ID {id}");

        return order;
    }
}