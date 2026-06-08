using MetraTC.Domain.Common;
using System;

namespace MetraTC.Domain.Entities;

public class OrderItem : BaseEntity
{
    public Guid OrderId { get; init; }
    public Guid ProductId { get; init; }

    public string ProductName { get; private set; }
    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }

    public decimal SubTotal => UnitPrice * Quantity;

    public Product? Product { get; init; }
    public Order? Order { get; init; }

#pragma warning disable CS8618
    private OrderItem() { }
#pragma warning restore CS8618

    public OrderItem(Guid orderId, Guid productId, string productName, decimal unitPrice, int quantity)
    {
        ValidateData(orderId, productId, productName, unitPrice, quantity);

        OrderId = orderId;
        ProductId = productId;
        ProductName = productName;
        UnitPrice = unitPrice;
        Quantity = quantity;
    }

    private void ValidateData(Guid orderId, Guid productId, string productName, decimal unitPrice, int quantity)
    {
        if (orderId == Guid.Empty)
            throw new ArgumentException("El ID de la orden no es válido", nameof(orderId));

        if (productId == Guid.Empty)
            throw new ArgumentException("El ID del producto no es válido", nameof(productId));

        if (string.IsNullOrWhiteSpace(productName))
            throw new ArgumentException("El nombre del producto es obligatorio", nameof(productName));

        if (decimal.IsNegative(unitPrice))
            throw new ArgumentException("El precio unitario no puede ser negativo", nameof(unitPrice));

        if (quantity <= 0)
            throw new ArgumentException("La cantidad debe ser mayor a cero", nameof(quantity));
    }
}