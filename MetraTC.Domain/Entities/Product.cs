using MetraTC.Domain.Common;
using System;
using System.Collections.Generic;
using System.Text;

namespace MetraTC.Domain.Entities;

public class Product : BaseEntity
{
    public string Sku { get; init; }
    public string? Barcode { get; private set; }
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public decimal Price { get; private set; }

    public ICollection<Category> Categories { get; private set; } = new List<Category>();

    public Product(string sku, string name, decimal price, string? barcode = null, string? description = null)
    {
        ValidateDataAndSku(sku, name, price);

        Sku = sku;
        Barcode = barcode;
        Name = name;
        Description = description;
        Price = price;
    }

    public void Update(string newName, decimal newPrice, string? newDescription)
    {
        ValidateData(newName, newPrice);

        Name = newName;
        Price = newPrice;
        Description = string.IsNullOrWhiteSpace(newDescription) ? null : newDescription;
    }

    private void ValidateDataAndSku(string sku, string name, decimal price)
    {
        if (string.IsNullOrWhiteSpace(sku))
            throw new ArgumentException("El SKU es obligatorio", nameof(sku));

        ValidateData(name, price);
    }

    private void ValidateData(string name, decimal price)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El nombre del producto es obligatorio", nameof(name));
        if (name.Length > 50)
            throw new ArgumentException("El nombre del producto no puede exceder los 50 caracteres");

        if (decimal.IsNegative(price))
            throw new ArgumentException("El precio del producto no puede ser negativo", nameof(price));
    }
}
