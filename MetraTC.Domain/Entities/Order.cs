using MetraTC.Domain.Common;
using MetraTC.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;

namespace MetraTC.Domain.Entities;

public class Order : BaseEntity
{
    public string OrderNumber { get; private set; }
    public DateTime Date { get; private set; }
    public OrderStatus Status { get; private set; }

    private readonly List<OrderItem> _items = new();
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    public decimal TotalAmount => _items.Sum(i => i.SubTotal);

#pragma warning disable CS8618
    private Order() { }
#pragma warning restore CS8618

    public Order(string orderNumber)
    {
        if (string.IsNullOrWhiteSpace(orderNumber))
            throw new ArgumentException("El número de orden es obligatorio", nameof(orderNumber));

        OrderNumber = orderNumber;
        Date = DateTime.UtcNow;
        Status = OrderStatus.Pending;
    }

    public void AddItem(Guid productId, string productName, decimal unitPrice, int quantity)
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException("No se pueden agregar ítems a una orden que no está pendiente");

        // El ID de la orden ya existe al momento de agregar el ítem gracias a BaseEntity
        var item = new OrderItem(Id, productId, productName, unitPrice, quantity);
        _items.Add(item);
    }

    public void Complete()
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException("Solo las órdenes pendientes pueden completarse");

        if (!_items.Any())
            throw new InvalidOperationException("No se puede completar una orden sin ítems");

        Status = OrderStatus.Completed;
    }

    public void Cancel()
    {
        if (Status == OrderStatus.Completed)
            throw new InvalidOperationException("No se puede cancelar una orden que ya fue completada");

        Status = OrderStatus.Cancelled;
    }
}