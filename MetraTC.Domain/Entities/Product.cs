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
    public int Stock { get; private set; }
    public string? ImageUrl { get; private set; }
    public string? Unit { get; private set; }
    public int? MinStock { get; private set; }

    public ICollection<Category> Categories { get; private set; } = new List<Category>();

    public Product(string sku, string name, decimal price, string? barcode = null, string? description = null, string? imageUrl = null, string? unit = null, int? minStock = null)
    {
        ValidateDataAndSku(sku, name, price);

        Sku = sku;
        Barcode = barcode;
        Name = name;
        Description = description;
        Price = price;
        Stock = 0;
        SetImageUrl(imageUrl);
        SetUnit(unit);
        SetMinStock(minStock);
    }

    public void Update(string newName, decimal newPrice, string? newDescription)
    {
        ValidateData(newName, newPrice);

        Name = newName;
        Price = newPrice;
        Description = string.IsNullOrWhiteSpace(newDescription) ? null : newDescription;
    }

    public void SetImageUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            ImageUrl = null;
            return;
        }
        var trimmed = url.Trim();
        if (trimmed.Length > 500)
            throw new ArgumentException("La URL de imagen no puede exceder 500 caracteres", nameof(url));
        ImageUrl = trimmed;
    }

    public void SetUnit(string? unit)
    {
        if (string.IsNullOrWhiteSpace(unit))
        {
            Unit = null;
            return;
        }
        var trimmed = unit.Trim();
        if (trimmed.Length < 1 || trimmed.Length > 20)
            throw new ArgumentException("La unidad debe tener entre 1 y 20 caracteres", nameof(unit));
        Unit = trimmed;
    }

    public void SetMinStock(int? min)
    {
        if (min == null)
        {
            MinStock = null;
            return;
        }
        if (min < 0 || min > 99999)
            throw new ArgumentException("El stock mínimo debe estar entre 0 y 99999", nameof(min));
        MinStock = min;
    }

    public bool IsLowStock()
    {
        if (MinStock.HasValue) return Stock <= MinStock.Value;
        return Stock <= 5;
    }

    public int AdjustStock(int delta)
    {
        if (delta == 0)
            throw new ArgumentException("El ajuste de stock no puede ser cero", nameof(delta));

        var resultingStock = (long)Stock + delta;
        if (resultingStock < 0)
            throw new ArgumentException("El stock resultante no puede ser negativo", nameof(delta));
        if (resultingStock > int.MaxValue)
            throw new ArgumentException("El stock resultante excede el límite permitido", nameof(delta));

        Stock = (int)resultingStock;
        return Stock;
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
